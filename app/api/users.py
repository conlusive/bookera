from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.models.user import User, RoleEnum
from app.schemas.user import BusinessOwnerCreate, UserResponse, UserLogin
from app.core.security import get_password_hash, verify_password
from app.api.deps import get_db

router = APIRouter()


@router.post("/register/business", response_model=UserResponse)
async def register_business_owner(user_data: BusinessOwnerCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == user_data.email))
    if result.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email вже зареєстрований")

    new_user = User(
        first_name=user_data.firstName,  # Зберігаємо ім'я
        last_name=user_data.lastName,  # Зберігаємо прізвище
        phone=user_data.phone,  # Зберігаємо телефон
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        role=RoleEnum.vendor
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


# НОВИЙ РОУТ ДЛЯ ВХОДУ (ЛОГІНУ)
@router.post("/login")
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    # 1. Шукаємо користувача за email
    result = await db.execute(select(User).filter(User.email == user_data.email))
    user = result.scalars().first()

    # 2. Перевіряємо, чи існує користувач і чи збігається пароль
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невірний email або пароль"
        )

    # 3. Якщо все ок - пускаємо (поки що просто повертаємо успішну відповідь)
    return {
        "message": "Успішний вхід",
        "user_id": user.id,
        "role": user.role,
        "name": user.first_name
    }


@router.get("/all", response_model=List[UserResponse])
async def get_all_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return result.scalars().all()