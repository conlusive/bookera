from datetime import datetime
from typing import List, Optional
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
    avatar_url: Optional[str] = None
    role: Optional[str] = None
    commission_rate: Optional[float] = None
    fixed_salary: Optional[float] = None
    tax_rate: Optional[float] = None
    payment_method: Optional[str] = None
    shifts: Optional[List[dict]] = None
    assigned_services: Optional[List[int]] = None
    provides_services: Optional[bool] = None
    is_active: Optional[bool] = None


class StaffResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    fixed_salary: Optional[float] = None
    tax_rate: Optional[float] = None
    payment_method: Optional[str] = None
    shifts: Optional[List[dict]] = None
    assigned_services: Optional[List[int]] = []
    provides_services: bool = True
    phone: Optional[str] = None
    role: str
    specialization: Optional[str] = None
    commission_rate: Optional[float] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
