from datetime import date, datetime, time
from typing import List, Literal, Optional
from pydantic import BaseModel
from app.models import BookingSourceEnum


class SlotStatusItem(BaseModel):
    time: str
    status: str  # "available", "booked", "locked"
    available_masters_count: int = 1


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
    # session_token - анонімний ідентифікатор браузерної сесії (генерує фронтенд,
    # напр. crypto.randomUUID() у localStorage). НЕ є ID реального клієнта з CRM -
    # потрібен лише щоб один браузер міг прибрати власний прострочений lock.
    session_token: Optional[str] = None
    client_id: Optional[int] = None  # заповнюється, лише якщо це реальний CRM-контакт
    source: BookingSourceEnum = BookingSourceEnum.DIRECT


class AppointmentCreate(BaseModel):
    business_id: int
    service_id: int
    start_time: datetime
    master_id: Optional[str] = "0"
    session_token: Optional[str] = None
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    source: Optional[BookingSourceEnum] = BookingSourceEnum.DIRECT


class AppointmentStatusUpdate(BaseModel):
    # Раніше було просто `str` - приймало будь-яке значення і могло зламати
    # фільтри в іншому коді, які звіряються з конкретними рядками.
    status: Literal["confirmed", "completed", "cancelled"]


class AppointmentResponse(BaseModel):
    id: int
    business_id: int
    service_id: int
    client_id: Optional[int] = None
    master_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str
    source: Optional[str] = "direct"
    price: Optional[float] = None
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


AppointmentOut = AppointmentResponse
