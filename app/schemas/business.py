from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class BusinessBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    slug: str
    address: str
    category: Optional[str] = None
    city: Optional[str] = "Львів"
    description: Optional[str] = None
    business_type: Optional[str] = None
    workspace_type: Optional[str] = None
    shifts: Optional[str] = None
    cover_photo: Optional[str] = None
    logo: Optional[str] = None
    phone: Optional[str] = None
    working_hours: Optional[str] = None


class BusinessCreate(BusinessBase):
    owner_id: str


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None
    city: Optional[str] = None
    description: Optional[str] = None
    cover_photo: Optional[str] = None
    logo: Optional[str] = None
    phone: Optional[str] = None
    working_hours: Optional[str] = None


class BusinessOut(BusinessBase):
    id: int
    owner_id: str
    rating: Optional[float] = 0.0
    reviews_count: Optional[int] = 0
    is_radar_active: bool = False
    virtual_balance: float = 0.0
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class BusinessResponse(BusinessOut):
    pass