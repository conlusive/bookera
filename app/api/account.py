"""
Власні дані користувача: імʼя, телефон, фото.

Раніше профіль писав ці дані НАПРЯМУ в Supabase, у таблицю `profiles`,
якої не існує - дані користувачів живуть у `users` на бекенді. Тож
зберегти імʼя, телефон чи фото було неможливо.

Пошти тут немає навмисно: вона - частина входу й змінюється через
Supabase Auth з підтвердженням листом (supabase.auth.updateUser).
Записати її сюди без підтвердження означало б дати змогу підставити
чужу адресу.
"""
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db
from app.models import User

router = APIRouter(prefix="/account", tags=["Account"])


class MeOut(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None


class MeUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=20)
    avatar_url: Optional[str] = Field(default=None, max_length=1000)


async def _get_or_create(db: AsyncSession, current_user: CurrentUser) -> User:
    res = await db.execute(select(User).where(User.id == str(current_user.id)))
    user = res.scalars().first()
    if not user:
        # Клієнт, що увійшов уперше й ще не має запису на бекенді.
        user = User(id=str(current_user.id), email=current_user.email, role="client", is_active=True)
        db.add(user)
        await db.flush()
    return user


def _out(user: User, current_user: CurrentUser) -> MeOut:
    return MeOut(email=user.email or current_user.email, full_name=user.full_name,
                 phone=user.phone, avatar_url=user.avatar_url, role=user.role)


@router.get("/me", response_model=MeOut)
async def get_me(db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    user = await _get_or_create(db, current_user)
    await db.commit()
    return _out(user, current_user)


@router.patch("/me", response_model=MeOut)
async def update_me(
    payload: MeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Змінюються лише передані поля: фото можна прибрати, передавши null."""
    user = await _get_or_create(db, current_user)
    data = payload.model_dump(exclude_unset=True)

    if "full_name" in data:
        name = (data["full_name"] or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Імʼя не може бути порожнім")
        user.full_name = name

    if "phone" in data:
        raw = (data["phone"] or "").strip()
        if raw:
            digits = re.sub(r"\D", "", raw)
            # Український номер: 380 + 9 цифр. Інакше - помилка, а не
            # тихо збережене «+380 12»: за телефоном профіль знаходить
            # записи, зроблені до реєстрації.
            if not (len(digits) == 12 and digits.startswith("380")):
                raise HTTPException(status_code=400, detail="Номер телефону має бути у форматі +380 XX XXX XX XX")
            user.phone = f"+{digits}"
        else:
            user.phone = None

    if "avatar_url" in data:
        url = data["avatar_url"]
        if url and not url.startswith("https://"):
            raise HTTPException(status_code=400, detail="Невірна адреса фото")
        user.avatar_url = url or None

    await db.commit()
    await db.refresh(user)
    return _out(user, current_user)
