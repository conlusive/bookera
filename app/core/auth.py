"""
Перевірка автентифікації для CRM-ендпоінтів.

Бекенд раніше НЕ перевіряв токени взагалі — будь-хто міг звертатись напряму
до API в обхід захисту, який є тільки на рівні Next.js middleware (UI).

Токен перевіряється локально (HS256, JWT secret проєкту Supabase) —
без мережевого запиту до Supabase на кожен виклик, це важливо для швидкості
під навантаженням. Secret лежить у Supabase: Settings -> API -> JWT Secret.
"""
import os
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

_bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: str
    email: Optional[str]
    role: Optional[str]


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Необхідна авторизація")

    if not SUPABASE_JWT_SECRET:
        # Свідомо жорстка помилка: тихо вимкнена перевірка токена - куди
        # небезпечніше за явний збій сервера, який одразу видно в логах/моніторингу.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET не налаштований на сервері",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сесія прострочена, увійдіть знову")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недійсний токен")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недійсний токен")

    role = (payload.get("user_metadata") or {}).get("role")
    return CurrentUser(id=user_id, email=payload.get("email"), role=role)


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
