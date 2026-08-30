from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class StaffInviteCreate(BaseModel):
    email: EmailStr
    role: str = "master"


class StaffInviteResponse(BaseModel):
    id: int
    business_id: int
    email: str
    role: str
    status: str
    created_at: datetime
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InviteAccept(BaseModel):
    token: str


class StaffUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    specialization: Optional[str] = None
    role: Optional[str] = None
    commission_rate: Optional[float] = None
    is_active: Optional[bool] = None


class StaffResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: str
    specialization: Optional[str] = None
    commission_rate: Optional[float] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
