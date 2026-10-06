"""
Завдатки онлайн і виплати закладам - так, як у Booksy / Fresha.

Закладів, які вимагають завдаток (налаштування «Передоплата»), клієнт платить його при записі карткою:
  awaiting  запис створено, чекаємо оплату (DEPOSIT_HOLD_MINUTES; не сплатили - запис знімається, слот вільний)
  held      завдаток сплачено, платформа тримає його до візиту
  retained  клієнт не прийшов: завдаток лишається закладу
  refunded  візит скасовано: завдаток повернено клієнту
  paid_out  завдаток увійшов у виплату закладу

Виплата (build_payout): завдатки за візити, що відбулися (completed) або де клієнт не прийшов (retained),
МІНУС комісія за нових клієнтів з вітрини, яка накопичилась (вирахувана автоматично, закладу не треба платити).
Реальні перекази поки робить адміністратор платформи й відмічає виплату сплаченою: автоматичні виплати
з'являться разом із платіжним провайдером.
"""
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import logger
from app.core.time_utils import utc_now
from app.models import Appointment, Business, Payment, ReferralCommission, SalonPayout
from app.services.monetization import OWED_STATUSES

DEPOSIT_HOLD_MINUTES = 15
# Мінімальна сума, з якої формується виплата (дрібниці копляться до наступного разу)
MIN_PAYOUT_UAH = Decimal("100")


async def expire_unpaid_deposits(db: AsyncSession, business_id: Optional[int] = None) -> int:
    """Знімає записи, за які не сплатили завдаток вчасно: слот знову вільний."""
    cutoff = utc_now() - timedelta(minutes=DEPOSIT_HOLD_MINUTES)
    stmt = select(Appointment).where(
        Appointment.deposit_status == "awaiting", Appointment.created_at < cutoff, Appointment.status != "cancelled",
    )
    if business_id is not None:
        stmt = stmt.where(Appointment.business_id == business_id)
    rows = (await db.execute(stmt)).scalars().all()
    for a in rows:
        a.status = "cancelled"
        a.deposit_status = None
    if rows:
        await db.commit()
        logger.info("Знято записи без сплаченого завдатку: %s", len(rows))
    return len(rows)


async def mark_deposit_paid(db: AsyncSession, payment: Payment) -> None:
    """Платіж завдатку підтверджено. Повтор нічого не змінює."""
    if payment.status == "completed":
        return
    payment.status = "completed"
    payment.completed_at = utc_now()
    appt = (await db.execute(select(Appointment).where(Appointment.deposit_payment_id == payment.id))).scalars().first()
    if not appt:
        logger.warning("Платіж завдатку %s без запису", payment.id)
        return
    if appt.status == "cancelled":
        # Оплатили вже після зняття запису (не вклались у час): гроші одразу повертаємо
        appt.deposit_paid = payment.amount
        appt.deposit_status = "held"
        await refund_deposit(db, appt)
        return
    appt.deposit_paid = payment.amount
    appt.deposit_status = "held"


async def refund_deposit(db: AsyncSession, appointment: Appointment) -> None:
    """Візит скасовано: завдаток повертається клієнту. Без провайдера повернення чекає ручного переказу."""
    if appointment.deposit_status not in ("held", "awaiting"):
        return
    was_paid = appointment.deposit_status == "held"
    appointment.deposit_status = "refunded"
    if not was_paid or not appointment.deposit_payment_id:
        return
    payment = await db.get(Payment, appointment.deposit_payment_id)
    if payment:
        from app.services.payments import refund_payment
        payment.status = "refunded" if refund_payment(payment) else "refund_pending"


async def apply_status_change(db: AsyncSession, appointment: Appointment, old: str, new: str) -> None:
    """Що завдаток робить, коли змінюється статус візиту (викликається з visit_hooks.on_status_change)."""
    if not appointment.deposit_status:
        return
    if new == "cancelled" and old != "cancelled":
        await refund_deposit(db, appointment)
    elif new == "no-show" and appointment.deposit_status == "held":
        appointment.deposit_status = "retained"
    elif old == "no-show" and new != "no-show" and appointment.deposit_status == "retained":
        appointment.deposit_status = "held"


async def _ready_deposits(db: AsyncSession, business_id: int) -> list[Appointment]:
    rows = (await db.execute(
        select(Appointment).where(
            Appointment.business_id == business_id,
            Appointment.deposit_status.in_(("held", "retained")),
        )
    )).scalars().all()
    return [a for a in rows if a.deposit_status == "retained" or a.status == "completed"]


async def finance_overview(db: AsyncSession, business: Business) -> dict:
    """Те, що заклад бачить у «Фінансах»: скільки тримається, скільки готове до виплати, що вирахувано, історія."""
    held_all = (await db.execute(
        select(Appointment).where(Appointment.business_id == business.id, Appointment.deposit_status == "held")
    )).scalars().all()
    ready = await _ready_deposits(db, business.id)
    ready_ids = {a.id for a in ready}
    on_hold = sum((Decimal(a.deposit_paid or 0) for a in held_all if a.id not in ready_ids), Decimal("0"))
    ready_gross = sum((Decimal(a.deposit_paid or 0) for a in ready), Decimal("0"))
    owed = (await db.execute(
        select(ReferralCommission).where(ReferralCommission.business_id == business.id, ReferralCommission.status.in_(OWED_STATUSES))
    )).scalars().all()
    commission_owed = sum((Decimal(c.amount) for c in owed), Decimal("0"))
    payouts = (await db.execute(
        select(SalonPayout).where(SalonPayout.business_id == business.id).order_by(SalonPayout.created_at.desc()).limit(24)
    )).scalars().all()
    offset = min(ready_gross, commission_owed)
    return {
        "on_hold": float(on_hold),            # завдатки за майбутні візити: платформа тримає до візиту
        "ready_gross": float(ready_gross),    # за візити, що відбулися: готово до виплати
        "commission_owed": float(commission_owed),
        "next_payout": float(max(ready_gross - offset, Decimal("0"))),
        "will_deduct": float(offset),         # скільки комісії вирахується з найближчої виплати
        "min_payout": float(MIN_PAYOUT_UAH),
        "has_payout_details": bool(business.payout_details and business.payout_details.get("value")),
        "payouts": [{
            "id": p.id, "gross": float(p.gross), "commission_offset": float(p.commission_offset),
            "amount": float(p.amount), "status": p.status,
            "created_at": p.created_at.isoformat() + "Z" if p.created_at else None,
            "paid_at": p.paid_at.isoformat() + "Z" if p.paid_at else None,
        } for p in payouts],
    }


async def build_payout(db: AsyncSession, business: Business) -> Optional[SalonPayout]:
    """
    Формує виплату закладу: готові завдатки мінус комісія. Нічого не робить без реквізитів чи без суми:
    завдатки не губляться, вони чекають наступного разу.
    """
    if not (business.payout_details and business.payout_details.get("value")):
        return None
    ready = await _ready_deposits(db, business.id)
    gross = sum((Decimal(a.deposit_paid or 0) for a in ready), Decimal("0")).quantize(Decimal("0.01"))
    if gross <= 0:
        return None

    owed = (await db.execute(
        select(ReferralCommission).where(
            ReferralCommission.business_id == business.id, ReferralCommission.status.in_(OWED_STATUSES)
        ).order_by(ReferralCommission.created_at)
    )).scalars().all()
    offset = Decimal("0")
    deducted: list[ReferralCommission] = []
    for c in owed:  # цілими рядками, від найстаріших, поки вистачає суми
        amount = Decimal(c.amount)
        if offset + amount <= gross:
            offset += amount
            deducted.append(c)
    net = (gross - offset).quantize(Decimal("0.01"))
    if net < MIN_PAYOUT_UAH and not (net == 0 and offset > 0):
        return None  # дрібниця: копичиться до наступної виплати

    payout = SalonPayout(
        business_id=business.id, gross=gross, commission_offset=offset.quantize(Decimal("0.01")), amount=net,
        status="pending", details=dict(business.payout_details),
    )
    if net == 0:  # усе пішло на комісію: переказувати нічого, виплата закрита одразу
        payout.status = "paid"
        payout.paid_at = utc_now()
    db.add(payout)
    await db.flush()
    for a in ready:
        a.deposit_status = "paid_out"
        a.deposit_payout_id = payout.id
    for c in deducted:
        c.status = "paid"
        c.payout_id = payout.id
    logger.info("Виплата закладу %s: брутто %s, комісія %s, до виплати %s", business.id, gross, offset, net)
    return payout


async def run_payouts(db: AsyncSession) -> list[SalonPayout]:
    """Формує виплати всім закладам, у яких є що виплатити. Безпечно викликати повторно."""
    ids = (await db.execute(
        select(Appointment.business_id).where(Appointment.deposit_status.in_(("held", "retained"))).distinct()
    )).scalars().all()
    created: list[SalonPayout] = []
    for bid in ids:
        business = await db.get(Business, bid)
        if not business:
            continue
        payout = await build_payout(db, business)
        if payout:
            created.append(payout)
    if created:
        await db.commit()
    return created
