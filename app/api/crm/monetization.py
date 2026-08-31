import secrets
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, get_current_user
from app.core.time_utils import utc_now
from app.core.rate_limit import rate_limit
from app.models import Business, GiftCertificate, Payment, PointsLedgerEntry, RadarBoost, ReferralCommission
from app.models import Expense, StaffPayout, User
from app.services.monetization import calculate_payout_preview
from app.schemas.monetization import (
    GiftCertificateCreate, GiftCertificateResponse,
    GiftCertificateRedeemRequest, GiftCertificateRedeemResponse,
    RadarActivateRequest, RadarStatusResponse,
    PointsLedgerItem, CommissionItem, MonetizationSummaryResponse,
    PayoutPreviewResponse, StaffPayoutCreate, StaffPayoutResponse,
    TransferOwnershipRequest,
)

router = APIRouter(tags=["CRM - Monetization"])

POINTS_PER_RADAR_DAY = 15  # скільки балів коштує 1 день буста


# === Зведена інформація ===

@router.get("/crm/businesses/{business_id}/monetization", response_model=MonetizationSummaryResponse)
async def get_monetization_summary(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_access(db, current_user, business_id)
    biz_res = await db.execute(select(Business).where(Business.id == business_id))
    business = biz_res.scalars().first()

    owed_res = await db.execute(
        select(func.coalesce(func.sum(ReferralCommission.amount), 0)).where(
            ReferralCommission.business_id == business_id, ReferralCommission.status == "pending"
        )
    )
    total_owed = owed_res.scalar() or Decimal("0")

    radar_res = await db.execute(
        select(RadarBoost).where(
            RadarBoost.business_id == business_id, RadarBoost.status == "active", RadarBoost.expires_at > utc_now()
        ).order_by(RadarBoost.expires_at.desc())
    )
    active_radar = radar_res.scalars().first()

    return MonetizationSummaryResponse(
        points_balance=business.points_balance,
        direct_link_token=business.direct_link_token,
        commission_rate=business.commission_rate,
        total_commission_owed=total_owed,
        radar_active=active_radar is not None,
        radar_expires_at=active_radar.expires_at if active_radar else None,
    )


@router.get("/crm/businesses/{business_id}/points-ledger", response_model=List[PointsLedgerItem])
async def get_points_ledger(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_access(db, current_user, business_id)
    result = await db.execute(
        select(PointsLedgerEntry).where(PointsLedgerEntry.business_id == business_id)
        .order_by(PointsLedgerEntry.created_at.desc()).limit(100)
    )
    return result.scalars().all()


@router.get("/crm/businesses/{business_id}/commissions", response_model=List[CommissionItem])
async def get_commissions(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_access(db, current_user, business_id)
    result = await db.execute(
        select(ReferralCommission).where(ReferralCommission.business_id == business_id)
        .order_by(ReferralCommission.created_at.desc()).limit(100)
    )
    return result.scalars().all()


# === Radar (платне просування) ===

@router.get("/crm/businesses/{business_id}/radar", response_model=RadarStatusResponse)
async def get_radar_status(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_access(db, current_user, business_id)
    biz_res = await db.execute(select(Business).where(Business.id == business_id))
    business = biz_res.scalars().first()

    radar_res = await db.execute(
        select(RadarBoost).where(
            RadarBoost.business_id == business_id, RadarBoost.status == "active", RadarBoost.expires_at > utc_now()
        ).order_by(RadarBoost.expires_at.desc())
    )
    active_radar = radar_res.scalars().first()
    return RadarStatusResponse(
        active=active_radar is not None,
        expires_at=active_radar.expires_at if active_radar else None,
        points_balance=business.points_balance,
    )


@router.post("/crm/businesses/{business_id}/radar/activate-with-points", response_model=RadarStatusResponse)
async def activate_radar_with_points(
    business_id: int,
    payload: RadarActivateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Оплата radar балами - працює вже зараз, без платіжного шлюзу.
    Оплата реальними грошима - окремий ендпоінт /radar/activate-with-payment,
    коли будуть підключені реквізити WayForPay.
    """
    await assert_business_access(db, current_user, business_id)
    biz_res = await db.execute(select(Business).where(Business.id == business_id))
    business = biz_res.scalars().first()

    cost = payload.days * POINTS_PER_RADAR_DAY
    if business.points_balance < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Недостатньо балів: потрібно {cost}, є {business.points_balance}",
        )

    business.points_balance -= cost
    db.add(PointsLedgerEntry(
        business_id=business_id, amount=-cost, reason="radar_purchase", balance_after=business.points_balance,
    ))

    # Якщо вже є активний буст - продовжуємо від його кінця, а не від "зараз"
    existing_res = await db.execute(
        select(RadarBoost).where(
            RadarBoost.business_id == business_id, RadarBoost.status == "active", RadarBoost.expires_at > utc_now()
        ).order_by(RadarBoost.expires_at.desc())
    )
    existing = existing_res.scalars().first()
    from datetime import timedelta
    start_from = existing.expires_at if existing else utc_now()

    boost = RadarBoost(
        business_id=business_id,
        expires_at=start_from + timedelta(days=payload.days),
        paid_with="points",
        points_spent=cost,
        status="active",
    )
    db.add(boost)
    await db.commit()

    return RadarStatusResponse(active=True, expires_at=boost.expires_at, points_balance=business.points_balance)


# === Подарункові сертифікати ===

@router.post("/crm/gift-certificates", response_model=GiftCertificateResponse, status_code=status.HTTP_201_CREATED)
async def create_gift_certificate(
    payload: GiftCertificateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_access(db, current_user, payload.business_id)
    from datetime import timedelta

    code = secrets.token_hex(4).upper()
    cert = GiftCertificate(
        business_id=payload.business_id,
        code=code,
        initial_amount=payload.amount,
        remaining_amount=payload.amount,
        purchaser_name=payload.purchaser_name,
        purchaser_email=payload.purchaser_email,
        message=payload.message,
        expires_at=utc_now() + timedelta(days=payload.valid_days),
    )
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    return cert


@router.get("/crm/gift-certificates", response_model=List[GiftCertificateResponse])
async def list_gift_certificates(
    business_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_access(db, current_user, business_id)
    result = await db.execute(
        select(GiftCertificate).where(GiftCertificate.business_id == business_id).order_by(GiftCertificate.created_at.desc())
    )
    return result.scalars().all()


@router.post("/public/gift-certificates/check", response_model=GiftCertificateRedeemResponse)
async def check_gift_certificate(
    payload: GiftCertificateRedeemRequest,
    db: AsyncSession = Depends(get_db),
    _rl=Depends(rate_limit("gift-check", max_requests=20, window_seconds=60)),
):
    """Публічна перевірка коду під час оформлення бронювання - без списання."""
    result = await db.execute(
        select(GiftCertificate).where(
            GiftCertificate.code == payload.code.upper(), GiftCertificate.business_id == payload.business_id
        )
    )
    cert = result.scalars().first()
    if not cert:
        return GiftCertificateRedeemResponse(valid=False, message="Сертифікат не знайдено")
    if cert.status != "active":
        return GiftCertificateRedeemResponse(valid=False, message="Сертифікат вже використаний або неактивний")
    if cert.expires_at and cert.expires_at < utc_now():
        return GiftCertificateRedeemResponse(valid=False, message="Термін дії сертифіката сплив")
    return GiftCertificateRedeemResponse(valid=True, remaining_amount=cert.remaining_amount, message="Сертифікат дійсний")


# === Виплати майстрам ===

@router.get("/crm/businesses/{business_id}/staff/{staff_id}/payout-preview", response_model=PayoutPreviewResponse)
async def get_payout_preview(
    business_id: int,
    staff_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Скільки належить майстру ЗАРАЗ, без фіксації - можна дивитись скільки завгодно раз."""
    await assert_business_access(db, current_user, business_id)
    preview = await calculate_payout_preview(db, business_id, staff_id)
    return PayoutPreviewResponse(**preview)


@router.post("/crm/businesses/{business_id}/staff/{staff_id}/payouts", response_model=StaffPayoutResponse, status_code=status.HTTP_201_CREATED)
async def create_payout(
    business_id: int,
    staff_id: str,
    payload: StaffPayoutCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Фіксує виплату - на відміну від preview, ЗАКРИВАЄ період (наступний
    preview почнеться вже звідси, той самий візит не потрапить у виплату
    двічі) і одразу створює пов'язаний запис витрати для обліку.
    """
    await assert_business_access(db, current_user, business_id)
    preview = await calculate_payout_preview(db, business_id, staff_id)

    if preview["payout_amount"] <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Немає нарахувань для виплати за цей період")

    staff_res = await db.execute(select(User).where(User.id == staff_id))
    staff = staff_res.scalars().first()
    staff_label = (staff.full_name or staff.email) if staff else staff_id

    expense = Expense(
        business_id=business_id,
        category="Виплата майстру",
        description=f"Виплата комісії: {staff_label}",
        amount=preview["payout_amount"],
    )
    db.add(expense)
    await db.flush()

    payout = StaffPayout(
        business_id=business_id,
        staff_id=staff_id,
        period_start=preview["period_start"],
        period_end=preview["period_end"],
        gross_revenue=preview["gross_revenue"],
        commission_rate_applied=preview["commission_rate"],
        payout_amount=preview["payout_amount"],
        notes=payload.notes,
        expense_id=expense.id,
    )
    db.add(payout)
    await db.commit()
    await db.refresh(payout)
    return payout


@router.get("/crm/businesses/{business_id}/staff/{staff_id}/payouts", response_model=List[StaffPayoutResponse])
async def list_payouts(
    business_id: int,
    staff_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_access(db, current_user, business_id)
    result = await db.execute(
        select(StaffPayout).where(StaffPayout.business_id == business_id, StaffPayout.staff_id == staff_id)
        .order_by(StaffPayout.paid_at.desc())
    )
    return result.scalars().all()


# === Передача власності ===

@router.post("/crm/businesses/{business_id}/transfer-ownership")
async def transfer_ownership(
    business_id: int,
    payload: TransferOwnershipRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Свідомо СУВОРІШЕ за звичайну CRM-дію: перевіряє, що викликає САМЕ
    поточний власник (не просто staff з доступом до закладу), і що новий
    власник - реально активний співробітник цього ж закладу. Стара роль
    перетворюється на 'admin' (не втрачає доступ, але вже не власник).
    """
    biz_res = await db.execute(select(Business).where(Business.id == business_id))
    business = biz_res.scalars().first()
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заклад не знайдено")

    if not business.owner_id or str(business.owner_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Лише поточний власник може передати права")

    if str(payload.new_owner_user_id) == str(current_user.id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не можна передати права самому собі")

    target_res = await db.execute(
        select(User).where(User.id == payload.new_owner_user_id, User.business_id == business_id, User.is_active == True)
    )
    target = target_res.scalars().first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Активного співробітника з таким id не знайдено в цьому закладі")

    old_owner_res = await db.execute(select(User).where(User.id == current_user.id))
    old_owner = old_owner_res.scalars().first()

    business.owner_id = target.id
    target.role = "business_owner"
    if old_owner:
        old_owner.role = "admin"

    await db.commit()
    return {"status": "success", "new_owner_id": target.id, "former_owner_id": current_user.id}
