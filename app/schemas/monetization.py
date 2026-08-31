from datetime import date, datetime
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
    days: int = Field(7, ge=1, le=90)


class RadarStatusResponse(BaseModel):
    active: bool
    expires_at: Optional[datetime] = None
    points_balance: int


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
