from datetime import datetime
import enum
from sqlalchemy import String, Integer, ForeignKey, DateTime, Enum as SQLEnum, Float, Column, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class RoleEnum(str, enum.Enum):
    client = "client"
    owner = "owner"
    admin = "admin"
    master = "master"


class StatusEnum(str, enum.Enum):
    pending = "pending"
    locked = "locked"
    confirmed = "confirmed"
    cancelled = "cancelled"


class User(Base):
    __tablename__ = "users"

    # 🔥 Змінюємо з Integer на String, бо Supabase Auth використовує UUID-рядки
    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    first_name: Mapped[str] = mapped_column(String, nullable=True)
    last_name: Mapped[str] = mapped_column(String, nullable=True)
    phone: Mapped[str] = mapped_column(String, nullable=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=True)

    role: Mapped[RoleEnum] = mapped_column(SQLEnum(RoleEnum), default=RoleEnum.client)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owned_business = relationship("Business", foreign_keys="[Business.owner_id]", back_populates="owner", uselist=False)
    workplace = relationship("Business", foreign_keys="[User.business_id]", back_populates="workplace")

    client_appointments = relationship("Appointment", foreign_keys="[Appointment.client_id]", back_populates="client")
    master_appointments = relationship("Appointment", foreign_keys="[Appointment.master_id]", back_populates="master")


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # 🔥 owner_id тепер String, бо посилається на текстовий ID у users
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String, index=True)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True)
    address: Mapped[str] = mapped_column(String)

    category: Mapped[str] = mapped_column(String, nullable=True, index=True)
    city: Mapped[str] = mapped_column(String, nullable=True, index=True)
    description: Mapped[str] = mapped_column(String, nullable=True)

    business_type: Mapped[str] = mapped_column(String, nullable=True)
    workspace_type: Mapped[str] = mapped_column(String, nullable=True)
    shifts: Mapped[str] = mapped_column(String, nullable=True)

    cover_photo: Mapped[str] = mapped_column(String, nullable=True)
    logo: Mapped[str] = mapped_column(String, nullable=True)
    phone: Mapped[str] = mapped_column(String, nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=True)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0, nullable=True)
    working_hours: Mapped[str] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)

    owner = relationship("User", foreign_keys=[owner_id], back_populates="owned_business")
    staff = relationship("User", foreign_keys="[User.business_id]", back_populates="workplace")
    services = relationship("Service", back_populates="business")
    appointments = relationship("Appointment", back_populates="business")
    invitations = relationship("BusinessInvite", back_populates="business")


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

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), index=True)
    service_id = Column(Integer, ForeignKey("services.id"))
    # 🔥 ID користувачів у записах також стають рядками
    client_id = Column(String, ForeignKey("users.id"))
    master_id = Column(String, ForeignKey("users.id"))

    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String)
    source = Column(String, default="Онлайн (Сторінка салону)")
    expires_at = Column(DateTime, nullable=True)

    business = relationship("Business", back_populates="appointments")
    client = relationship("User", foreign_keys=[client_id], back_populates="client_appointments")
    master = relationship("User", foreign_keys=[master_id], back_populates="master_appointments")


class BusinessInvite(Base):
    __tablename__ = "business_invites"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"))
    email: Mapped[str] = mapped_column(String, index=True)
    role: Mapped[RoleEnum] = mapped_column(SQLEnum(RoleEnum))
    token: Mapped[str] = mapped_column(String, unique=True, index=True)
    is_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="invitations")