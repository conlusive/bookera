import secrets
from datetime import timedelta
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_admin, get_current_user, assert_section
from app.core.time_utils import utc_now
from app.core.rate_limit import rate_limit
from app.models import Appointment, Business, GiftCertificate, Payment, PointsLedgerEntry, RadarBoost, ReferralCommission
from app.models import Expense, StaffMembership, StaffPayout, User
from app.services import ranking
from app.services.monetization import calculate_payout_preview
from app.services.payments import create_payment_intent
from app.schemas.monetization import (
    GiftCertificateCreate, GiftCertificateResponse,
    GiftCertificateRedeemRequest, GiftCertificateRedeemResponse,
    RadarActivateRequest, RadarStatusResponse, RadarPackageOut, RadarPositionOut, RadarResultsOut, RadarHistoryItem,
    PointsLedgerItem, CommissionItem, MonetizationSummaryResponse,
    PayoutPreviewResponse, StaffPayoutCreate, StaffPayoutResponse,
    TransferOwnershipRequest,
)

router = APIRouter(tags=["CRM - Monetization"])

# Комісії, що ще не оплачені: нараховані й виставлені в платежі, який не підтверджено
OWED_STATUSES = ("pending", "invoiced")



# === Зведена інформація ===

async def _assert_admin_or_self(db: AsyncSession, current_user: CurrentUser, business_id: int, staff_id: str) -> None:
    """
    Власник чи адміністратор - будь-кого в закладі. Майстер - лише себе,
    і лише на читання: свій заробіток і свої виплати він бачити має,
    а чужі - ні. Раніше майстер отримував 403 навіть на власну зарплату.
    """
    if str(current_user.id) == str(staff_id):
        from app.models import StaffMembership
        member = (await db.execute(select(StaffMembership).where(
            StaffMembership.user_id == str(current_user.id),
            StaffMembership.business_id == business_id,
            StaffMembership.is_active.is_(True),
        ))).scalars().first()
        if member:
            return
    await assert_business_admin(db, current_user, business_id)


@router.get("/crm/businesses/{business_id}/monetization", response_model=MonetizationSummaryResponse)
async def get_monetization_summary(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_section(db, current_user, business_id, "analytics")
    biz_res = await db.execute(select(Business).where(Business.id == business_id))
    business = biz_res.scalars().first()

    owed_res = await db.execute(
        select(func.coalesce(func.sum(ReferralCommission.amount), 0)).where(
            ReferralCommission.business_id == business_id,
            ReferralCommission.status.in_(OWED_STATUSES),
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
    await assert_section(db, current_user, business_id, "analytics")
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
    await assert_section(db, current_user, business_id, "analytics")
    result = await db.execute(
        select(ReferralCommission).where(ReferralCommission.business_id == business_id)
        .order_by(ReferralCommission.created_at.desc()).limit(100)
    )
    return result.scalars().all()


@router.post("/crm/businesses/{business_id}/commissions/checkout")
async def checkout_commissions(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Оплата накопиченої комісії карткою - так само, як підписка чи Радар. Без ключів WayForPay оплата
    тестова й комісії закриваються одразу; зі справжніми повертаємо підписану форму, а закриває їх
    підтвердження від платіжної системи (callback, замовлення cm-...).

    Грошима керує лише власник чи адміністратор. У платіж потрапляють усі неоплачені комісії закладу;
    суму рахує сервер, а не клієнт. Рядки, виставлені в покинутому платежі, перевиставляються в новому.
    """
    await assert_business_admin(db, current_user, business_id)
    business = await _get_business_or_404(db, business_id)

    rows = (await db.execute(
        select(ReferralCommission).where(
            ReferralCommission.business_id == business_id, ReferralCommission.status.in_(OWED_STATUSES),
        ).with_for_update()
    )).scalars().all()
    amount = sum((Decimal(r.amount) for r in rows), Decimal("0")).quantize(Decimal("0.01"))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Немає комісії до сплати")

    order_id = f"cm-{business_id}-{secrets.token_hex(6)}"
    intent = create_payment_intent(
        amount, order_id, f"Комісія BookEra за клієнтів з вітрини — {business.name}", return_url="/cabinet",
    )
    payment = Payment(
        business_id=business_id, purpose="commission", amount=amount,
        provider=intent.provider, provider_ref=order_id, status="pending",
    )
    db.add(payment)
    await db.flush()
    for r in rows:
        r.payment_id = payment.id
        r.status = "invoiced"
    await db.flush()  # сесія без autoflush: без цього вибірка за payment_id нічого не знайшла б

    paid = False
    if intent.status == "completed":
        await complete_commission_payment(db, payment)
        paid = True
        from app.services.audit import record as _audit
        await _audit(db, business_id, str(current_user.id), "marketing", "commission_paid",
                     f"Сплачено комісію BookEra: {amount} ₴ ({len(rows)} візитів)")
    await db.commit()
    return {"amount": amount, "visits": len(rows), "paid": paid, "checkout": intent.checkout, "checkout_url": intent.checkout_url}


async def complete_commission_payment(db: AsyncSession, payment: Payment) -> None:
    """Платіж комісії підтверджено: закриваємо всі комісії, виставлені в ньому. Повтор нічого не змінює."""
    if payment.status == "completed":
        return
    payment.status = "completed"
    payment.completed_at = utc_now()
    rows = (await db.execute(
        select(ReferralCommission).where(ReferralCommission.payment_id == payment.id)
    )).scalars().all()
    for r in rows:
        r.status = "paid"


# === Radar (платне просування) ===

def _bad_package(days: int) -> HTTPException:
    allowed = ", ".join(str(p["days"]) for p in ranking.RADAR_PACKAGES)
    return HTTPException(status_code=400, detail=f"Обери пакет Радара: {allowed} днів")


async def _radar_overview(db: AsyncSession, business: Business, **extra) -> RadarStatusResponse:
    """Усе, що показує сторінка «Радар»: стан, ціни, позиція, результат, історія."""
    now = utc_now()
    active_boosts = (await db.execute(
        select(RadarBoost).where(
            RadarBoost.business_id == business.id, RadarBoost.status == "active", RadarBoost.expires_at > now
        ).order_by(RadarBoost.expires_at.desc())
    )).scalars().all()
    expires = active_boosts[0].expires_at if active_boosts else None
    days_left = 0
    if expires:
        days_left = max(1, -(-int((expires - now).total_seconds()) // 86400))

    balance = business.points_balance or 0
    packages = [
        RadarPackageOut(**p, can_afford_points=balance >= p["price_points"]) for p in ranking.packages_view()
    ]

    position = RadarPositionOut(**(await ranking.position_in_market(db, business)))

    def storefront_count(start, end):
        return select(func.count(Appointment.id)).where(
            Appointment.business_id == business.id,
            Appointment.source == "marketplace",
            Appointment.status != "cancelled",
            Appointment.created_at >= start, Appointment.created_at < end,
        )
    d30, d60 = now - timedelta(days=30), now - timedelta(days=60)
    results = RadarResultsOut(
        storefront_bookings_30d=(await db.execute(storefront_count(d30, now))).scalar() or 0,
        storefront_bookings_prev_30d=(await db.execute(storefront_count(d60, d30))).scalar() or 0,
    )

    boosts = (await db.execute(
        select(RadarBoost, Payment.amount).outerjoin(Payment, Payment.id == RadarBoost.payment_id)
        .where(RadarBoost.business_id == business.id)
        .order_by(RadarBoost.created_at.desc()).limit(10)
    )).all()
    history = [
        RadarHistoryItem(
            started_at=bo.started_at, expires_at=bo.expires_at, paid_with=bo.paid_with,
            points_spent=bo.points_spent, amount_uah=float(amount) if amount is not None else None,
            is_active=bo.status == "active" and bo.expires_at > now,
        )
        for bo, amount in boosts
    ]

    return RadarStatusResponse(
        active=expires is not None, expires_at=expires, points_balance=balance, days_left=days_left,
        packages=packages, position=position, results=results, history=history,
        rules=ranking.ranking_rules(), **extra,
    )


async def _get_business_or_404(db: AsyncSession, business_id: int) -> Business:
    business = (await db.execute(select(Business).where(Business.id == business_id))).scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")
    return business


@router.get("/crm/businesses/{business_id}/radar", response_model=RadarStatusResponse)
async def get_radar_status(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_section(db, current_user, business_id, "analytics")
    return await _radar_overview(db, await _get_business_or_404(db, business_id))


@router.post("/crm/businesses/{business_id}/radar/activate-with-points", response_model=RadarStatusResponse)
async def activate_radar_with_points(
    business_id: int,
    payload: RadarActivateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Оплата Радара балами - працює без платіжного шлюзу. Гроші чи бали
    витрачає лише власник / адміністратор.
    """
    await assert_business_admin(db, current_user, business_id)
    package = ranking.package_for_days(payload.days)
    if not package:
        raise _bad_package(payload.days)

    # FOR UPDATE: два одночасні натиски не спишуть бали двічі з одного балансу
    business = (await db.execute(
        select(Business).where(Business.id == business_id).with_for_update()
    )).scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    cost = package["price_points"]
    if (business.points_balance or 0) < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Недостатньо балів: потрібно {cost}, є {business.points_balance or 0}",
        )

    business.points_balance -= cost
    db.add(PointsLedgerEntry(
        business_id=business_id, amount=-cost, reason="radar_purchase", balance_after=business.points_balance,
    ))
    await ranking.grant_radar(db, business_id, package["days"], paid_with="points", points_spent=cost)
    from app.services.audit import record as _audit
    await _audit(db, business_id, str(current_user.id), "marketing", "radar_activated",
                 f"Підключено Радар: {package['days']} днів, {cost} балів")
    await db.commit()
    await db.refresh(business)
    return await _radar_overview(db, business)


@router.post("/crm/businesses/{business_id}/radar/checkout", response_model=RadarStatusResponse)
async def checkout_radar(
    business_id: int,
    payload: RadarActivateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Оплата Радара карткою. Без ключів WayForPay оплата тестова й дні
    нараховуються одразу (так само, як підписка й подарункові картки);
    зі справжніми - повертаємо підписану форму, а пакет активує
    підтвердження від платіжної системи.
    """
    await assert_business_admin(db, current_user, business_id)
    package = ranking.package_for_days(payload.days)
    if not package:
        raise _bad_package(payload.days)
    business = await _get_business_or_404(db, business_id)

    amount = Decimal(package["price_uah"])
    order_id = f"rb-{business_id}-{package['days']}-{secrets.token_hex(6)}"
    intent = create_payment_intent(
        amount, order_id, f"Радар BookEra, {package['days']} днів — {business.name}",
        return_url="/cabinet",
    )
    payment = Payment(
        business_id=business_id, purpose="radar_boost", amount=amount,
        provider=intent.provider, provider_ref=order_id, status="pending",
    )
    db.add(payment)
    await db.flush()
    activated = False
    if intent.status == "completed":
        await complete_radar_payment(db, payment)
        activated = True
        from app.services.audit import record as _audit
        await _audit(db, business_id, str(current_user.id), "marketing", "radar_activated",
                     f"Підключено Радар: {package['days']} днів, {package['price_uah']} ₴ карткою")
    await db.commit()
    await db.refresh(business)
    return await _radar_overview(db, business, activated=activated, checkout=intent.checkout, checkout_url=intent.checkout_url)


async def complete_radar_payment(db: AsyncSession, payment: Payment) -> None:
    """
    Оплату Радара підтверджено: фіксуємо платіж і нараховуємо дні.
    Кількість днів - з номера замовлення (rb-<заклад>-<дні>-<код>), який ми
    самі склали; повторне підтвердження нічого не нараховує вдруге.
    """
    if payment.status == "completed":
        return
    try:
        days = int(str(payment.provider_ref).split("-")[2])
    except (IndexError, ValueError):
        days = 0
    package = ranking.package_for_days(days)
    if not package:
        raise HTTPException(status_code=400, detail="Невідомий пакет Радара")
    payment.status = "completed"
    payment.completed_at = utc_now()
    await ranking.grant_radar(db, payment.business_id, package["days"], paid_with="payment", payment_id=payment.id)


# === Подарункові сертифікати ===

@router.post("/crm/gift-certificates", response_model=GiftCertificateResponse, status_code=status.HTTP_201_CREATED)
async def create_gift_certificate(
    payload: GiftCertificateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_section(db, current_user, payload.business_id, "analytics")
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
    await assert_section(db, current_user, business_id, "analytics")
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
    await _assert_admin_or_self(db, current_user, business_id, staff_id)
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

    await assert_business_admin(db, current_user, business_id)

    # ПІСЛЯ перевірки прав: інакше сторонній дізнавався б про стан
    # налаштувань оплати, не маючи доступу до закладу.
    # Власнику зарплату не виплачуємо, і без налаштованої оплати - теж:
    # інакше сума бралась би з типових значень, яких ніхто не обирав.
    _biz = (await db.execute(select(Business).where(Business.id == business_id))).scalars().first()
    if _biz and str(_biz.owner_id) == str(staff_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Власник не отримує зарплату - у нього прибуток закладу")
    _staff = (await db.execute(select(User).where(User.id == str(staff_id)))).scalars().first()
    if _staff and not _staff.pay_configured_at:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Спершу налаштуйте оплату цього майстра")
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
        commission_part=preview.get("commission_part"),
        fixed_part=preview.get("fixed_part"),
        tax_amount=preview.get("tax_amount"),
        materials_cost=preview.get("materials_cost"),
        appointments_count=preview.get("completed_appointments_count"),
        notes=payload.notes,
        expense_id=expense.id,
    )
    db.add(payout)
    # Журнал дій
    from app.services.audit import record as _audit
    await _audit(db, business_id, str(current_user.id), "money", "payout_created", f"Виплата {staff_label}: {payout.payout_amount} ₴")
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
    await _assert_admin_or_self(db, current_user, business_id, staff_id)
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

    from app.services.audit import record as _audit
    # Спершу запис, поки поточний власник ще власник: інакше в журналі він уже «адміністратор».
    await _audit(db, business_id, str(current_user.id), "team", "ownership_transferred",
                 f"Передано права власника: {target.full_name or target.email}")
    business.owner_id = target.id
    target.role = "business_owner"
    if old_owner:
        old_owner.role = "admin"

    # Роль людини В ЦЬОМУ закладі зберігається ще й у членстві - список команди читає саме її.
    # Без цього після передачі колишній власник лишався там «Власником», а новий - «Адміністратором».
    memberships = (await db.execute(
        select(StaffMembership).where(
            StaffMembership.business_id == business_id,
            StaffMembership.user_id.in_([str(target.id), str(current_user.id)]),
        )
    )).scalars().all()
    for m in memberships:
        m.role = "business_owner" if str(m.user_id) == str(target.id) else "admin"

    await db.commit()
    return {"status": "success", "new_owner_id": target.id, "former_owner_id": current_user.id}


@router.delete("/crm/businesses/{business_id}/staff/{staff_id}/payouts/{payout_id}", response_model=StaffPayoutResponse)
async def cancel_payout(
    business_id: int,
    staff_id: str,
    payout_id: int,
    reason: str = Query("", description="Причина скасування"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Скасовує помилкову виплату. Не видаляє запис, а позначає статусом:
    історія має лишатись повною для обліку.

    Важливо: візити з цієї виплати автоматично повертаються в наступний
    розрахунок, бо calculate_payout_preview бере за початок періоду лише
    ОСТАННЮ НЕ скасовану виплату. Інакше гроші за ці візити зникли б.
    """
    await assert_business_admin(db, current_user, business_id)

    result = await db.execute(
        select(StaffPayout).where(
            StaffPayout.id == payout_id,
            StaffPayout.business_id == business_id,
            StaffPayout.staff_id == staff_id,
        )
    )
    payout = result.scalars().first()
    if not payout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Виплату не знайдено")
    if payout.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Цю виплату вже скасовано")

    payout.status = "cancelled"
    payout.cancelled_at = utc_now()
    payout.cancel_reason = reason or None

    # Прибираємо повʼязану витрату, щоб скасована виплата не спотворювала
    # звітність по витратах закладу.
    if payout.expense_id:
        exp_res = await db.execute(select(Expense).where(Expense.id == payout.expense_id))
        expense = exp_res.scalars().first()
        if expense:
            await db.delete(expense)
        payout.expense_id = None

    # Журнал дій

    from app.services.audit import record as _audit

    await _audit(db, business_id, str(current_user.id), "money", "payout_cancelled", f"Скасовано виплату #{payout.id}: {payout.payout_amount} ₴")

    await db.commit()
    await db.refresh(payout)
    return payout


@router.get("/crm/businesses/{business_id}/payouts/due")
async def list_due_payouts(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Кому вже пора платити - за налаштованою періодичністю (payout_period
    і payout_day у картці майстра).

    Свідомо зроблено як запит на вимогу, а не фоновий процес: автоматичне
    списання грошей без відома власника - надто ризикована поведінка.
    CRM показує список "час виплати", а рішення ухвалює людина.
    """
    await assert_business_admin(db, current_user, business_id)

    staff_res = await db.execute(
        select(User).where(User.business_id == business_id, User.is_active == True)
    )
    biz = (await db.execute(select(Business).where(Business.id == business_id))).scalars().first()
    now = utc_now()
    due = []

    for staff in staff_res.scalars().all():
        # Власник зарплати не отримує - у нього прибуток закладу. Раніше
        # кабінет рахував йому 100% власного доходу й пропонував
        # «виплатити зарплату» самому собі.
        if biz and str(biz.owner_id) == str(staff.id):
            continue
        # Оплату не налаштовано - зарплати ще не існує.
        if not staff.pay_configured_at or not staff.payout_period or staff.payout_period == "none":
            continue

        last_res = await db.execute(
            select(StaffPayout)
            .where(
                StaffPayout.business_id == business_id,
                StaffPayout.staff_id == staff.id,
                StaffPayout.status != "cancelled",
            )
            .order_by(StaffPayout.paid_at.desc())
            .limit(1)
        )
        last = last_res.scalars().first()
        last_date = last.paid_at if last else None
        # Перший період - від налаштування оплати, а не «одразу»: раніше
        # «немає жодної виплати» означало «пора платити», і новий салон
        # отримував нагадування ще до першого клієнта.
        anchor = last_date or staff.pay_configured_at
        period_days = 7 if staff.payout_period == "weekly" else 30
        is_due = (now - anchor).days >= period_days

        if not is_due:
            continue

        preview = await calculate_payout_preview(db, business_id, staff.id)
        if preview["payout_amount"] <= 0:
            continue

        due.append({
            "staff_id": staff.id,
            "staff_name": staff.full_name or staff.email,
            "payout_period": staff.payout_period,
            "payout_day": staff.payout_day,
            "last_payout_at": last_date,
            "amount_due": preview["payout_amount"],
            "appointments_count": preview["completed_appointments_count"],
        })

    return {"business_id": business_id, "checked_at": now, "due": due}
