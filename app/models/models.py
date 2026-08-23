import enum
from datetime import datetime, date, time
from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey,
    DateTime, Date, Time as SQLTime, Numeric, Enum, JSON, Text
)
from sqlalchemy.orm import relationship
from app.models.base import Base


class RoleEnum(str, enum.Enum):
    CLIENT = "client"
    VENDOR = "vendor"
    MASTER = "master"
    master = "master"
    ADMIN = "admin"
    BUSINESS_OWNER = "business_owner"
    STAFF = "staff"


class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    BLOCKED = "blocked"


class BookingSourceEnum(str, enum.Enum):
    DIRECT = "direct"
    ONLINE = "online"
    MANUAL = "manual"
    MARKETPLACE = "marketplace"
    WIDGET = "widget"
    INSTAGRAM = "instagram"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    role = Column(String, default="client")
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="staff", foreign_keys=[business_id])
    owned_businesses = relationship("Business", back_populates="owner", foreign_keys="Business.owner_id")
    appointments = relationship("Appointment", back_populates="user", foreign_keys="Appointment.user_id")


class Business(Base):
    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    category = Column(String, default="Салон краси")
    address = Column(String, nullable=True)
    city = Column(String, default="Львів")
    phone = Column(String, nullable=True)
    rating = Column(Numeric(2, 1), default=5.0)
    reviews_count = Column(Integer, default=0)
    cover_photo = Column(Text, nullable=True)
    logo = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    open_time = Column(String, default="09:00")
    close_time = Column(String, default="20:00")
    days_off = Column(JSON, default=list)  # [0 = Нд, 1 = Пн, ...]
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="owned_businesses", foreign_keys=[owner_id])
    staff = relationship("User", back_populates="business", foreign_keys=[User.business_id])
    services = relationship("Service", back_populates="business", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="business", cascade="all, delete-orphan")


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    duration_minutes = Column(Integer, default=60)
    is_group = Column(Boolean, default=False)
    max_participants = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="services")
    appointments = relationship("Appointment", back_populates="service")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    client_id = Column(String, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    master_id = Column(String, ForeignKey("users.id"), nullable=True)

    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(String, default="confirmed")  # confirmed, blocked, cancelled, completed
    source = Column(String, default="direct")

    price = Column(Numeric(10, 2), nullable=True)
    client_name = Column(String, nullable=True)
    client_phone = Column(String, nullable=True)
    client_email = Column(String, nullable=True)

    expires_at = Column(DateTime, nullable=True)  # Для 10-хв блокування
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="appointments", foreign_keys=[user_id])
    business = relationship("Business", back_populates="appointments")
    service = relationship("Service", back_populates="appointments")


class LockedSlot(Base):
    __tablename__ = "locked_slots"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    date = Column(Date, nullable=False)
    time = Column(SQLTime, nullable=False)
    locked_until = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)