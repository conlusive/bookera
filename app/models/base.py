from sqlalchemy import String, Integer, ForeignKey, DateTime, Enum, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import enum
from app.core.database import Base

class RoleEnum(str, enum.Enum):
    client = "client"
    vendor = "vendor"
    admin = "admin"

class StatusEnum(str, enum.Enum):
    pending = "pending"
    locked = "locked"
    confirmed = "confirmed"
    cancelled = "cancelled"

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum), default=RoleEnum.client)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="owner", uselist=False)

class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String, index=True)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True)
    address: Mapped[str] = mapped_column(String)

    owner = relationship("User", back_populates="business")
    services = relationship("Service", back_populates="business")
    appointments = relationship("Appointment", back_populates="business")

class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"))
    name: Mapped[str] = mapped_column(String)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Float)

    business = relationship("Business", back_populates="services")

class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"))
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"))
    start_time: Mapped[datetime] = mapped_column(DateTime)
    end_time: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[StatusEnum] = mapped_column(Enum(StatusEnum), default=StatusEnum.pending)

    business = relationship("Business", back_populates="appointments")