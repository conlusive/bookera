from datetime import datetime
import enum
import uuid
from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    DateTime,
    Enum as SQLEnum,
    Float,
    Boolean,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class RoleEnum(str, enum.Enum):
    client = "client"
    owner = "owner"
    vendor = "vendor"
    admin = "admin"
    master = "master"


class BookingSourceEnum(str, enum.Enum):
    DIRECT = "DIRECT"
    BOOKERA_SEARCH = "BOOKERA_SEARCH"
    BOOKERA_PROMO = "BOOKERA_PROMO"


class TransactionTypeEnum(str, enum.Enum):
    REFERRAL_BONUS = "REFERRAL_BONUS"
    RADAR_SPEND = "RADAR_SPEND"
    COMMISSION_FEE = "COMMISSION_FEE"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    first_name: Mapped[str] = mapped_column(String, nullable=True)
    last_name: Mapped[str] = mapped_column(String, nullable=True)
    phone: Mapped[str] = mapped_column(String, nullable=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=True)

    role: Mapped[RoleEnum] = mapped_column(SQLEnum(RoleEnum), default=RoleEnum.client)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owned_business = relationship("Business", foreign_keys="[Business.owner_id]", back_populates="owner", uselist=False)
    workplace = relationship("Business", foreign_keys="[User.business_id]", back_populates="staff")

    client_appointments = relationship("Appointment", foreign_keys="[Appointment.client_id]", back_populates="client")
    master_appointments = relationship("Appointment", foreign_keys="[Appointment.master_id]", back_populates="master")


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
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

    is_radar_active: Mapped[bool] = mapped_column(Boolean, default=False)
    virtual_balance: Mapped[float] = mapped_column(Float, default=0.0)

    cover_photo: Mapped[str] = mapped_column(String, nullable=True)
    logo: Mapped[str] = mapped_column(String, nullable=True)
    phone: Mapped[str] = mapped_column(String, nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=True)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0, nullable=True)
    working_hours: Mapped[str] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_id], back_populates="owned_business")
    staff = relationship("User", foreign_keys="[User.business_id]", back_populates="workplace")
    services = relationship("Service", back_populates="business", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="business", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="business", cascade="all, delete-orphan")
    coupons = relationship("Coupon", back_populates="business", cascade="all, delete-orphan")


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"))
    name: Mapped[str] = mapped_column(String)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Float)

    is_group: Mapped[bool] = mapped_column(Boolean, default=False)
    max_participants: Mapped[int] = mapped_column(Integer, default=1)
    addon_service_ids: Mapped[dict | list] = mapped_column(JSON, default=list, nullable=True)

    business = relationship("Business", back_populates="services")


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"))
    client_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=True)
    master_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=True)

    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String, default="blocked")
    source: Mapped[BookingSourceEnum] = mapped_column(SQLEnum(BookingSourceEnum), default=BookingSourceEnum.DIRECT)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    business = relationship("Business", back_populates="appointments")
    service = relationship("Service")
    client = relationship("User", foreign_keys=[client_id], back_populates="client_appointments")
    master = relationship("User", foreign_keys=[master_id], back_populates="master_appointments")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"))
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    transaction_type: Mapped[TransactionTypeEnum] = mapped_column(SQLEnum(TransactionTypeEnum), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="transactions")


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String, unique=True, index=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"))
    discount_amount: Mapped[float] = mapped_column(Float, nullable=False)
    is_percentage: Mapped[bool] = mapped_column(Boolean, default=False)
    valid_until: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="coupons")