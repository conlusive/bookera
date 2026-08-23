from typing import List, Optional, Any
from pydantic import BaseModel
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

    class Config:
        from_attributes = True


class BusinessBase(BaseModel):
    name: str
    slug: str
    category: Optional[str] = "Салон краси"
    address: Optional[str] = None
    city: Optional[str] = "Львів"
    phone: Optional[str] = None
    rating: Optional[Decimal] = Decimal("5.0")
    reviews_count: Optional[int] = 0
    cover_photo: Optional[str] = None
    logo: Optional[str] = None
    tags: Optional[List[str]] = []
    open_time: Optional[str] = "09:00"
    close_time: Optional[str] = "20:00"
    days_off: Optional[List[int]] = []


class BusinessOut(BusinessBase):
    id: int
    is_active: bool = True
    services: Optional[List[ServiceOut]] = []

    class Config:
        from_attributes = True