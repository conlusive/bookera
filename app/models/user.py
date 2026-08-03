from datetime import datetime
import enum
from sqlalchemy import String, Integer, ForeignKey, DateTime, Enum as SQLEnum, Float, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)

    # ДОДАНО ForeignKey для правильних зв'язків:
    business_id = Column(Integer, ForeignKey("businesses.id"), index=True)
    service_id = Column(Integer, ForeignKey("services.id"))
    client_id = Column(Integer, ForeignKey("users.id"))
    master_id = Column(Integer, ForeignKey("users.id"))

    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String)

    source = Column(String, default="Онлайн (Сторінка салону)")
    expires_at = Column(DateTime, nullable=True)

    # ДОДАНО зв'язок із салоном
    business = relationship("Business", back_populates="appointments")


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
    first_name: Mapped[str] = mapped_column(String, nullable=True)
    last_name: Mapped[str] = mapped_column(String, nullable=True)
    phone: Mapped[str] = mapped_column(String, nullable=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String)
    role: Mapped[RoleEnum] = mapped_column(SQLEnum(RoleEnum), default=RoleEnum.client)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="owner", uselist=False)


class Business(Base):
    __tablename__ = "businesses"

    # Базові поля
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String, index=True)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True)
    address: Mapped[str] = mapped_column(String)

    # Пошук та інформація
    category: Mapped[str] = mapped_column(String, nullable=True, index=True)
    city: Mapped[str] = mapped_column(String, nullable=True, index=True)
    description: Mapped[str] = mapped_column(String, nullable=True)

    # Медіа, контакти та рейтинги
    cover_photo: Mapped[str] = mapped_column(String, nullable=True)
    logo: Mapped[str] = mapped_column(String, nullable=True)
    phone: Mapped[str] = mapped_column(String, nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=True)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0, nullable=True)
    working_hours: Mapped[str] = mapped_column(String, nullable=True)

    # 🔥 ТЕ САМЕ ПОЛЕ, ЯКОГО БРАКУВАЛО:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)

    # Зв'язки
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