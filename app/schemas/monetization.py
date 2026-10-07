from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class GiftCertificateCreate(BaseModel):
    business_id: int
    amount: Decimal = Field(..., gt=0)
    purchaser_name: Optional[str] = None
    purchaser_email: Optional[str] = None
    message: Optional[str] = None
    valid_days: int = Field(365, ge=1, le=1095)


class GiftCertificateResponse(BaseModel):
    id: int
    business_id: int
    code: str
    initial_amount: Decimal
    remaining_amount: Decimal
    status: str
    purchaser_name: Optional[str] = None
    message: Optional[str] = None
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class GiftCertificateRedeemRequest(BaseModel):
    code: str
    business_id: int


class GiftCertificateRedeemResponse(BaseModel):
    valid: bool
    remaining_amount: Optional[Decimal] = None
    message: str


class RadarActivateRequest(BaseModel):
    # Лише з пакетів ranking.RADAR_PACKAGES (7 / 14 / 30). Перевіряє обробник.
    days: int = Field(7, ge=1, le=90)


class RadarPackageOut(BaseModel):
    days: int
    price_uah: int
    price_points: int
    per_day_uah: float
    discount_percent: int
    can_afford_points: bool
    commitment: bool = False
    commission_rate: Optional[float] = None


class RadarPositionOut(BaseModel):
    total: int
    position: int
    position_without_radar: int
    position_with_radar: int


class RadarResultsOut(BaseModel):
    # Записи з вітрини Bookera (не з прямого посилання) за останні 30 днів
    # і за попередні 30 - щоб було з чим порівняти.
    storefront_bookings_30d: int
    storefront_bookings_prev_30d: int


class RadarHistoryItem(BaseModel):
    started_at: Optional[datetime] = None
    expires_at: datetime
    paid_with: str
    points_spent: Optional[int] = None
    amount_uah: Optional[float] = None
    is_active: bool


class RadarStatusResponse(BaseModel):
    active: bool
    expires_at: Optional[datetime] = None
    points_balance: int
    days_left: int = 0
    packages: List[RadarPackageOut] = []
    position: Optional[RadarPositionOut] = None
    results: Optional[RadarResultsOut] = None
    history: List[RadarHistoryItem] = []
    rules: Optional[dict] = None
    # Лише для відповіді на оплату карткою
    activated: Optional[bool] = None
    checkout: Optional[dict] = None
    checkout_url: Optional[str] = None


class PointsLedgerItem(BaseModel):
    id: int
    amount: int
    reason: str
    balance_after: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CommissionItem(BaseModel):
    id: int
    appointment_id: int
    amount: Decimal
    rate_applied: Decimal
    reason: str
    status: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class MonetizationSummaryResponse(BaseModel):
    points_balance: int
    direct_link_token: Optional[str] = None
    commission_rate: Decimal
    total_commission_owed: Decimal
    radar_active: bool
    radar_expires_at: Optional[datetime] = None


class PayoutPreviewResponse(BaseModel):
    staff_id: str
    period_start: datetime
    period_end: datetime
    gross_revenue: Decimal          # виручка за виконані візити
    tips_amount: Decimal = Decimal("0")  # чайові майстрові за період
    commission_rate: Decimal        # % майстра
    commission_part: Decimal = Decimal("0")   # скільки з цього відсотка
    fixed_part: Decimal = Decimal("0")        # фіксована ставка
    tax_rate: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")        # утримано
    materials_cost: Decimal = Decimal("0")    # витрачено матеріалів
    materials_deducted: bool = False          # чи віднімається від виплати
    payout_amount: Decimal          # підсумок до виплати
    completed_appointments_count: int


class StaffPayoutCreate(BaseModel):
    notes: Optional[str] = None


class StaffPayoutResponse(BaseModel):
    id: int
    business_id: int
    staff_id: str
    period_start: datetime
    period_end: datetime
    gross_revenue: Decimal
    commission_rate_applied: Decimal
    payout_amount: Decimal
    commission_part: Optional[Decimal] = None
    fixed_part: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    materials_cost: Optional[Decimal] = None
    appointments_count: Optional[int] = None
    status: str
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TransferOwnershipRequest(BaseModel):
    new_owner_user_id: str
