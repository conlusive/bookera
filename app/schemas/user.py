from pydantic import BaseModel, EmailStr
from app.models.user import RoleEnum
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str
    role: Optional[RoleEnum] = RoleEnum.client

class BusinessOwnerCreate(BaseModel):
    firstName: str
    lastName: str
    email: EmailStr
    phone: str
    password: str

# НОВА СХЕМА ДЛЯ ЛОГІНУ
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    role: RoleEnum
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str