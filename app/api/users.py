from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db
from app.models.base import User
from app.schemas.user import UserCreate, UserResponse

# Створюємо роутер для юзерів
router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/", response_model=UserResponse)
async def create_user(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    # 1. Перевіряємо, чи існує вже такий email
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Користувач з таким email вже зареєстрований")

    # 2. Створюємо об'єкт моделі
    new_user = User(email=user_in.email, role=user_in.role)

    # 3. Зберігаємо в базу
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return new_user