from pydantic import BaseModel, EmailStr
from typing import Optional
from .models import RoleEnum

# Схема для реєстрації користувача
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: Optional[RoleEnum] = RoleEnum.client

# Схема для відповіді (читання) користувача (без пароля!)
class UserRead(BaseModel):
    id: int
    email: EmailStr
    role: RoleEnum

    class Config:
        from_attributes = True  # Дозволяє працювати з SQLAlchemy моделями

# Схема для JWT токена
class Token(BaseModel):
    access_token: str
    token_type: str