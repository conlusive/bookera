from pydantic import BaseModel, EmailStr
from datetime import datetime
from app.models.base import RoleEnum

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    role: RoleEnum = RoleEnum.client

class UserResponse(UserBase):
    id: int
    role: RoleEnum
    created_at: datetime

    class Config:
        from_attributes = True