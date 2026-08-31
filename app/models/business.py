from datetime import datetime, time as dt_time

from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey,
    DateTime, Numeric, JSON, Text, Time, SmallInteger, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.time_utils import utc_now
from app.models.base import Base


class Business(Base):
    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    category = Column(String, default="Салон краси")
    business_type = Column(String, nullable=True)
    workspace_type = Column(String, nullable=True)
    description = Column(Text, nullable=True)

    address = Column(String, nullable=True)
    city = Column(String, default="Львів")
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)

    rating = Column(Numeric(2, 1), default=5.0)
    reviews_count = Column(Integer, default=0)
    cover_photo = Column(Text, nullable=True)
    logo = Column(Text, nullable=True)
    tags = Column(JSON, default=list)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Гнучкі JSON-налаштування - не потребують окремих таблиць, бо ніколи
    # не фільтруються/не JOIN'яться, лише читаються й перезаписуються цілком.
    accent_color = Column(String, nullable=True)
    layout_config = Column(JSON, nullable=True)
    workplace_photos = Column(JSON, default=list)
    booking_settings = Column(JSON, nullable=True)
    security_settings = Column(JSON, nullable=True)
    notification_settings = Column(JSON, nullable=True)
    payments_settings = Column(JSON, nullable=True)

    # === Монетизація ===
    # Унікальний токен для "прямого" посилання бізнесу (Instagram-біо тощо) -
    # клієнти, що прийшли через нього, НЕ рахуються комісією. На відміну від
    # старого коду, де "звідки прийшов клієнт" визначав сам фронтенд (можна
    # було підмінити), тут це перевіряється на бекенді проти цього токена.
    direct_link_token = Column(String, unique=True, index=True, nullable=True)
    commission_rate = Column(Numeric(5, 2), default=10.00, nullable=False)  # % з завершеного візиту
    points_balance = Column(Integer, default=0, nullable=False)

    owner = relationship("User", back_populates="owned_businesses", foreign_keys=[owner_id])
    staff = relationship("User", back_populates="business", foreign_keys="User.business_id")
    services = relationship("Service", back_populates="business", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="business", cascade="all, delete-orphan")
    hours = relationship("BusinessHours", back_populates="business", cascade="all, delete-orphan")
    clients = relationship("Client", back_populates="business", cascade="all, delete-orphan")
    invites = relationship("StaffInvite", back_populates="business", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="business", cascade="all, delete-orphan")
    inventory_items = relationship("InventoryItem", back_populates="business", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="business", cascade="all, delete-orphan")
    points_entries = relationship("PointsLedgerEntry", back_populates="business", cascade="all, delete-orphan")
    commissions = relationship("ReferralCommission", back_populates="business", cascade="all, delete-orphan")
    radar_boosts = relationship("RadarBoost", back_populates="business", cascade="all, delete-orphan")
    gift_certificates = relationship("GiftCertificate", back_populates="business", cascade="all, delete-orphan")


class BusinessHours(Base):
    """
    Замінює JSON-поле businesses.shifts. weekday: 0=понеділок ... 6=неділя
    (ISO, а не JS-стиль 0=неділя, який був у старому коді - джерело майбутніх багів).
    """
    __tablename__ = "business_hours"
    __table_args__ = (UniqueConstraint("business_id", "weekday", name="uq_business_weekday"),)

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    weekday = Column(SmallInteger, nullable=False)  # 0-6
    is_open = Column(Boolean, default=True, nullable=False)
    open_time = Column(Time, default=dt_time(9, 0), nullable=False)
    close_time = Column(Time, default=dt_time(20, 0), nullable=False)

    business = relationship("Business", back_populates="hours")
