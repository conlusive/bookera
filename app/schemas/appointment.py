from datetime import date, datetime, time
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict
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
    # direct_link_token - токен з "прямого" посилання бізнесу (Instagram-біо тощо).
    # Сервер сам вирішує джерело (direct/marketplace) звірянням із business.direct_link_token -
    # клієнтське поле "source" видалене навмисно, бо раніше його міг підмінити будь-хто,
    # просто відправивши інше значення в тілі запиту (без жодної перевірки).
    direct_link_token: Optional[str] = None


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
    direct_link_token: Optional[str] = None
    gift_certificate_code: Optional[str] = None


class ManualAppointmentCreate(BaseModel):
    """Для CRM-календаря: staff вручну вносить запис (дзвінок/walk-in)."""
    business_id: int
    service_id: Optional[int] = None  # None лише якщо is_block=true
    start_time: datetime
    duration_minutes: Optional[int] = None  # обов'язково, якщо is_block=true (немає послуги, щоб узяти тривалість звідти)
    master_id: Optional[str] = None
    client_id: Optional[int] = None  # існуючий CRM-контакт
    client_name: Optional[str] = None  # або новий контакт "з голови"
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    notes: Optional[str] = None
    is_block: bool = False  # true = "заблокувати час" (обід тощо), не справжній запис клієнта


class AppointmentRescheduleRequest(BaseModel):
    start_time: datetime


class AppointmentStatusUpdate(BaseModel):
    # Раніше було просто `str` - приймало будь-яке значення і могло зламати
    # фільтри в іншому коді, які звіряються з конкретними рядками.
    status: Literal["confirmed", "completed", "cancelled"]


class ManageBookingRequest(BaseModel):
    token: str


class AppointmentResponse(BaseModel):
    id: int
    business_id: int
    service_id: Optional[int] = None
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

    model_config = ConfigDict(from_attributes=True)


AppointmentOut = AppointmentResponse
