import enum
from datetime import datetime

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Numeric, Boolean, Text
from sqlalchemy.orm import relationship

from app.core.time_utils import utc_now
from app.models.base import Base


class PointsReasonEnum(str, enum.Enum):
    NEW_CLIENT_REFERRED = "new_client_referred"  # бізнес привів нового для екосистеми клієнта
    RADAR_PURCHASE = "radar_purchase"  # списання балів на буст
    MANUAL_ADJUSTMENT = "manual_adjustment"  # ручне коригування (підтримка)


class PointsLedgerEntry(Base):
    """
    Повна історія нарахувань/списань балів - ніколи не змінюємо
    business.points_balance напряму без запису сюди. balance_after
    зберігається для швидкого аудиту без перерахунку з нуля.
    """
    __tablename__ = "points_ledger"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    amount = Column(Integer, nullable=False)  # +/-
    reason = Column(String, nullable=False)
    reference_client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    balance_after = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    business = relationship("Business", back_populates="points_entries")


class ReferralCommission(Base):
    """
    Комісія, яку заклад має сплатити Bookera за клієнта, приведеного
    маркетплейсом (або будь-якого клієнта під час активного radar).
    Нараховується в момент завершення візиту (status='completed'),
    а не бронювання - бо комісія має сенс лише за фактично надану послугу.
    """
    __tablename__ = "referral_commissions"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, unique=True)
    amount = Column(Numeric(10, 2), nullable=False)
    rate_applied = Column(Numeric(5, 2), nullable=False)
    reason = Column(String, nullable=False)  # 'marketplace_source' або 'radar_active'
    status = Column(String, default="pending", nullable=False)  # pending, invoiced, paid, waived
    created_at = Column(DateTime, default=utc_now)

    business = relationship("Business", back_populates="commissions")
    appointment = relationship("Appointment")


class RadarBoost(Base):
    """Платне просування закладу в пошуку (аналог 'піднятиш' на OLX)."""
    __tablename__ = "radar_boosts"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    started_at = Column(DateTime, default=utc_now)
    expires_at = Column(DateTime, nullable=False)
    paid_with = Column(String, nullable=False)  # 'points' або 'payment'
    points_spent = Column(Integer, nullable=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=True)
    status = Column(String, default="active", nullable=False)  # active, expired, cancelled
    created_at = Column(DateTime, default=utc_now)

    business = relationship("Business", back_populates="radar_boosts")


class GiftCertificate(Base):
    __tablename__ = "gift_certificates"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)
    initial_amount = Column(Numeric(10, 2), nullable=False)
    remaining_amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String, default="active", nullable=False)  # active, redeemed, expired, cancelled
    purchaser_name = Column(String, nullable=True)
    purchaser_email = Column(String, nullable=True)
    message = Column(Text, nullable=True)  # "З днем народження, мамо!"
    created_at = Column(DateTime, default=utc_now)
    expires_at = Column(DateTime, nullable=True)

    business = relationship("Business", back_populates="gift_certificates")


class Payment(Base):
    """
    Абстракція над платіжним провайдером. provider='mock' працює вже зараз
    (для тестів і локальної розробки), provider='wayforpay' - справжні гроші,
    щойно будуть реквізити продавця.
    """
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    purpose = Column(String, nullable=False)  # radar_boost, gift_certificate_purchase
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, default="UAH", nullable=False)
    provider = Column(String, nullable=False)  # mock, wayforpay
    provider_ref = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False)  # pending, completed, failed, refunded
    created_at = Column(DateTime, default=utc_now)
    completed_at = Column(DateTime, nullable=True)


class StaffPayout(Base):
    """
    Виплата комісії майстру за виконані візити. Прив'язана до конкретного
    періоду (від попередньої виплати до моменту нарахування), щоб той самий
    завершений візит ніколи не увійшов у дві різні виплати.
    """
    __tablename__ = "staff_payouts"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    staff_id = Column(String, ForeignKey("users.id"), nullable=False)

    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    gross_revenue = Column(Numeric(10, 2), nullable=False)  # сума завершених візитів за період
    commission_rate_applied = Column(Numeric(5, 2), nullable=False)  # % майстра на момент виплати
    payout_amount = Column(Numeric(10, 2), nullable=False)

    status = Column(String, default="paid", nullable=False)  # paid (виплата - завжди доконаний факт)
    paid_at = Column(DateTime, default=utc_now)
    notes = Column(Text, nullable=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=True)  # пов'язаний запис витрати

    created_at = Column(DateTime, default=utc_now)
