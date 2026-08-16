from datetime import date, datetime, time
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.models.user import BookingSourceEnum


class SlotStatusItem(BaseModel):
    time: str                      # Формат "10:00"
    status: str                    # "available" | "locked" | "booked"
    available_masters_count: int   # Кількість вільних майстрів


class AvailableSlotsResponse(BaseModel):
    date: date
    service_id: int
    duration_minutes: int
    slots: List[SlotStatusItem]


class LockSlotRequest(BaseModel):
    business_id: int
    service_id: int
    start_time: datetime
    master_id: Optional[str] = "0"
    client_id: Optional[str] = None
    source: BookingSourceEnum = BookingSourceEnum.DIRECT


class AppointmentCreate(BaseModel):
    business_id: int
    service_id: int
    start_time: datetime
    master_id: str
    client_id: Optional[str] = None
    source: BookingSourceEnum = BookingSourceEnum.DIRECT


class AppointmentResponse(BaseModel):
    id: int
    business_id: int
    service_id: int
    client_id: Optional[str] = None
    master_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str
    source: BookingSourceEnum
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# 🟢 Аліас для сумісності з app/schemas/__init__.py
AppointmentOut = AppointmentResponse