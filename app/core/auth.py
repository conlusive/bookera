"""
Перевірка автентифікації для CRM-ендпоінтів.

Бекенд раніше НЕ перевіряв токени взагалі — будь-хто міг звертатись напряму
до API в обхід захисту, який є тільки на рівні Next.js middleware (UI).

Supabase має ДВІ схеми підпису токенів:
  - нова (за замовчуванням у свіжих проєктах): асиметрична, ES256/RS256.
    Перевіряється публічним ключем, який Supabase віддає за адресою
    /.well-known/jwks.json - секрет для цього не потрібен взагалі.
  - стара (legacy): симетрична HS256 зі спільним секретом (JWT Secret).

Код підтримує обидві: спершу пробує JWKS (працює без жодних налаштувань),
і лише якщо це не вдалось - відкочується на HS256 через SUPABASE_JWT_SECRET.
"""
import os
import ssl
from dataclasses import dataclass
from typing import Optional

import certifi
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.logging_config import logger

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")

_bearer_scheme = HTTPBearer(auto_error=False)
_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> Optional[PyJWKClient]:
    """PyJWKClient сам кешує завантажені ключі, тож мережевий запит іде
    не на кожну перевірку токена, а лише коли зустрівся невідомий ключ."""
    global _jwks_client
    if not SUPABASE_URL:
        return None
    if _jwks_client is None:
        # Явно передаємо кореневі сертифікати з certifi. Без цього на macOS
        # (і в частині Docker-образів) Python не бачить системного сховища
        # сертифікатів і падає з CERTIFICATE_VERIFY_FAILED, не змігши
        # завантажити публічні ключі Supabase.
        # Свідомо НЕ вимикаємо перевірку сертифіката (ssl._create_unverified_context):
        # це відкрило б можливість підмінити ключі підробленим з'єднанням.
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        _jwks_client = PyJWKClient(
            f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json",
            ssl_context=ssl_context,
        )
    return _jwks_client


def _decode_token(token: str) -> dict:
    """Пробує асиметричний підпис (нові проєкти Supabase), потім HS256 (legacy)."""
    last_error: Optional[Exception] = None

    jwks_client = _get_jwks_client()
    if jwks_client is not None:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256"],
                audience="authenticated",
            )
        except jwt.ExpiredSignatureError:
            raise
        except Exception as e:
            last_error = e

    if SUPABASE_JWT_SECRET:
        try:
            return jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except jwt.ExpiredSignatureError:
            raise
        except Exception as e:
            last_error = e

    if last_error is not None:
        raise last_error
    raise RuntimeError(
        "Не налаштовано жодного способу перевірки токена: потрібен SUPABASE_URL "
        "(для нових асиметричних ключів) або SUPABASE_JWT_SECRET (для legacy HS256)"
    )


@dataclass
class CurrentUser:
    id: str
    email: Optional[str]
    role: Optional[str]
    full_name: Optional[str] = None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Необхідна авторизація")

    if not SUPABASE_URL and not SUPABASE_JWT_SECRET:
        # Свідомо жорстка помилка: тихо вимкнена перевірка токена - куди
        # небезпечніше за явний збій сервера, який одразу видно в логах.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Перевірка токенів не налаштована: задайте SUPABASE_URL або SUPABASE_JWT_SECRET",
        )

    try:
        payload = _decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сесія прострочена, увійдіть знову")
    except Exception as e:
        logger.warning(f"Не вдалося перевірити токен: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недійсний токен")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недійсний токен")

    metadata = payload.get("user_metadata") or {}
    return CurrentUser(
        id=user_id,
        email=payload.get("email"),
        role=metadata.get("role"),
        # Імʼя, вказане при реєстрації акаунта - щоб картка власника в CRM
        # не показувала email замість імені.
        full_name=metadata.get("full_name"),
    )


async def assert_business_access(db: AsyncSession, current_user: CurrentUser, business_id: int) -> None:
    """Перевіряє, що поточний користувач - власник або staff цього закладу."""
    from app.models import Business, User  # локальний імпорт, щоб уникнути циклу

    result = await db.execute(select(Business).where(Business.id == business_id))
    business = result.scalars().first()
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заклад не знайдено")

    if business.owner_id is not None and str(business.owner_id) == str(current_user.id):
        return

    staff_result = await db.execute(
        select(User).where(User.id == str(current_user.id), User.business_id == business_id)
    )
    if staff_result.scalars().first():
        return

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Немає доступу до цього закладу")


async def require_business_access(
    business_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    """
    Готова FastAPI-залежність для ендпоінтів, де business_id - це query/path
    параметр (наприклад GET /appointments/booked?business_id=...).
    Для ендпоінтів, де business_id приходить у тілі запиту, використовуйте
    assert_business_access(...) напряму всередині функції.
    """
    await assert_business_access(db, current_user, business_id)
    return current_user
