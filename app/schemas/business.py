from datetime import time as dt_time
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from decimal import Decimal


class ServiceOut(BaseModel):
    id: int
    business_id: int
    name: str
    description: Optional[str] = None
    price: Decimal
    duration_minutes: int
    is_group: bool = False
    max_participants: int = 1
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class BusinessHoursItem(BaseModel):
    weekday: int  # 0=понеділок ... 6=неділя
    is_open: bool = True
    open_time: dt_time = dt_time(9, 0)
    close_time: dt_time = dt_time(20, 0)

    model_config = ConfigDict(from_attributes=True)


class BusinessBase(BaseModel):
    name: str
    category: Optional[str] = "Салон краси"
    business_type: Optional[str] = None
    workspace_type: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = "Львів"
    phone: Optional[str] = None
    email: Optional[str] = None
    cover_photo: Optional[str] = None
    logo: Optional[str] = None
    tags: Optional[List[str]] = []


class BusinessCreate(BusinessBase):
    # slug генерується на бекенді (унікальність гарантована тут, а не хаотично на фронті)
    hours: Optional[List[BusinessHoursItem]] = None


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    cover_photo: Optional[str] = None
    logo: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None


class BusinessOut(BusinessBase):
    id: int
    slug: str
    rating: Optional[Decimal] = Decimal("5.0")
    reviews_count: Optional[int] = 0
    is_active: bool = True
    services: Optional[List[ServiceOut]] = []

    model_config = ConfigDict(from_attributes=True)
