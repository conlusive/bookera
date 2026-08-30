import enum
from datetime import datetime

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Numeric, Computed, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class AppointmentStatus(str, enum.Enum):
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    BLOCKED = "blocked"  # тимчасовий 10-хв лок під час оформлення


class BookingSourceEnum(str, enum.Enum):
    DIRECT = "direct"        # клієнт прийшов напряму до салону (без комісії)
    MARKETPLACE = "marketplace"  # прийшов через Bookera (з комісією)
    MANUAL = "manual"        # staff вручну вбив запис у CRM-календар
    WIDGET = "widget"
    INSTAGRAM = "instagram"


class Appointment(Base):
    """
    ОДНА таблиця бронювань для всього: і клієнт з маркетплейсу, і майстер,
    що вручну заносить запис у CRM-календар, пишуть сюди. Раніше це були
    дві окремі таблиці ('appointments' через FastAPI, 'bookings' напряму з
    Supabase) - подвійне бронювання між ними ніяк не перевірялось.
    """
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)  # реальний CRM-контакт
    session_token = Column(String, nullable=True, index=True)  # анонімна сесія браузера під час оформлення (для очищення власних locks)
    master_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_by_staff_id = Column(String, ForeignKey("users.id"), nullable=True)

    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(String, default="confirmed", nullable=False)
    source = Column(String, default="direct", nullable=False)

    price = Column(Numeric(10, 2), nullable=True)

    # Знімок контактів на момент бронювання - зберігається навіть для
    # гостьових бронювань без Client-запису.
    client_name = Column(String, nullable=True)
    client_phone = Column(String, nullable=True)
    client_email = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    expires_at = Column(DateTime, nullable=True)  # для 10-хв блокування

    # Ключ для DB-рівневого захисту від перетинів (exclusion constraint
    # у міграції). Якщо є майстер - ключ = master_id, інакше = сам заклад.
    booking_key = Column(
        String,
        Computed("COALESCE(master_id, 'BIZ-' || business_id::text)", persisted=True),
    )

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="appointments")
    service = relationship("Service", back_populates="appointments")
    client = relationship("Client", back_populates="appointments")
    master = relationship("User", back_populates="appointments_as_master", foreign_keys=[master_id])
    review = relationship("Review", back_populates="appointment", uselist=False)
