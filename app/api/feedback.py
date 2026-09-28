"""
Відгук і чайові від клієнта - за токеном керування записом.

  GET  /appointments/{id}/feedback?token=   - що показати на сторінці
  POST /appointments/{id}/tip               - чайові майстрові онлайн

Чайові пропонуємо лише ПІСЛЯ оцінки 4-5 (це вирішує інтерфейс): просити
грошей у людини, яка щойно поставила «двійку», - погана ідея. Сервер
приймає чайові за будь-який завершений візит, бо клієнт може захотіти
подякувати й сам.

Правила: лише завершений візит; не пізніше 14 днів після нього; один
раз онлайн; 10 - 10 000 ₴. Пропонуємо як у ресторані: 5 / 10 / 15% від
вартості візиту або своя сума. 100% - майстрові (tip_amount -> виплата).
"""
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging_config import logger
from app.core.time_utils import local_now, utc_now
from app.models import Appointment, Business, Service, User
from app.models.extras import Review
from app.models.monetization import Payment
from app.services.payments import create_payment_intent

router = APIRouter(tags=["Client feedback"])

# Мінімум 10 ₴: 5% від недорогої послуги (200 ₴) - це 10 ₴, і вони мають пройти.
TIP_MIN, TIP_MAX = 10, 10000
# Як у ресторані - відсоток від вартості візиту
TIP_PERCENTS = [5, 10, 15]
TIP_WINDOW_DAYS = 14


async def _by_token(db: AsyncSession, appointment_id: int, token: str) -> Appointment:
    a = await db.get(Appointment, appointment_id)
    if not a or not a.manage_token or a.manage_token != token:
        raise HTTPException(status_code=404, detail="Запис не знайдено")
    return a


async def _online_tip(db: AsyncSession, appointment_id: int) -> Optional[Payment]:
    return (await db.execute(select(Payment).where(
        Payment.purpose == "tip", Payment.provider_ref.like(f"tip-{appointment_id}-%"),
        Payment.status == "completed",
    ))).scalars().first()


@router.get("/appointments/{appointment_id}/feedback")
async def feedback_info(appointment_id: int, token: str, db: AsyncSession = Depends(get_db)):
    a = await _by_token(db, appointment_id, token)
    biz = await db.get(Business, a.business_id)
    srv = await db.get(Service, a.service_id) if a.service_id else None
    master = (await db.execute(select(User).where(User.id == str(a.master_id)))).scalars().first() if a.master_id else None
    review = (await db.execute(select(Review).where(Review.appointment_id == a.id))).scalars().first()
    tipped = await _online_tip(db, a.id)
    now = local_now().replace(tzinfo=None)
    in_window = bool(a.end_time and now - a.end_time <= timedelta(days=TIP_WINDOW_DAYS))
    return {
        "status": a.status,
        "business_name": biz.name if biz else None,
        "business_slug": biz.slug if biz else None,
        "master_name": (master.full_name if master and master.full_name else None),
        "master_avatar": master.avatar_url if master else None,
        "service_name": srv.name if srv else None,
        "start_time": a.start_time.isoformat() if a.start_time else None,
        "price": float(a.price) if a.price else None,
        "review": {
            "rating": review.rating, "master_rating": review.master_rating or review.rating,
            "salon_rating": review.salon_rating or review.rating, "comment": review.comment,
        } if review else None,
        "tip": {
            "paid": float(tipped.amount) if tipped else None,
            "can_tip": a.status == "completed" and in_window and not tipped and bool(a.master_id),
            "min": TIP_MIN, "max": TIP_MAX, "percents": TIP_PERCENTS,
        },
    }


class TipIn(BaseModel):
    token: str
    amount: int = Field(ge=TIP_MIN, le=TIP_MAX)


def apply_tip(a: Appointment, amount: Decimal) -> None:
    """Чайові додаються до вже записаних (скажімо, готівкою в салоні)."""
    a.tip_amount = (Decimal(str(a.tip_amount)) if a.tip_amount else Decimal("0")) + amount


@router.post("/appointments/{appointment_id}/tip")
async def tip_master(appointment_id: int, payload: TipIn, db: AsyncSession = Depends(get_db)):
    a = await _by_token(db, appointment_id, payload.token)
    if a.status != "completed":
        raise HTTPException(status_code=409, detail="Чайові - після візиту")
    if not a.master_id:
        raise HTTPException(status_code=409, detail="У цього візиту немає майстра")
    now = local_now().replace(tzinfo=None)
    if not a.end_time or now - a.end_time > timedelta(days=TIP_WINDOW_DAYS):
        raise HTTPException(status_code=409, detail="Чайові можна залишити протягом 14 днів після візиту")
    if await _online_tip(db, a.id):
        raise HTTPException(status_code=409, detail="Ви вже подякували майстрові за цей візит")

    amount = Decimal(payload.amount)
    master = (await db.execute(select(User).where(User.id == str(a.master_id)))).scalars().first()
    order_id = f"tip-{a.id}-{uuid.uuid4().hex[:10]}"
    intent = create_payment_intent(amount, order_id, f"Чайові майстру {(master.full_name or '') if master else ''}".strip())
    payment = Payment(business_id=a.business_id, purpose="tip", amount=amount,
                      provider=intent.provider, provider_ref=order_id, status="pending")
    db.add(payment)

    if intent.status == "completed":
        payment.status = "completed"
        payment.completed_at = utc_now()
        apply_tip(a, amount)
        from app.services.audit import record
        await record(db, a.business_id, None, "money", "tip_online",
                     f"Чайові онлайн {payload.amount} ₴ від {a.client_name or 'клієнта'} для {(master.full_name if master else '') or 'майстра'}")
    await db.commit()
    return {"status": payment.status, "checkout_url": intent.checkout_url, "amount": payload.amount}


async def complete_tip_payment(db: AsyncSession, payment: Payment) -> None:
    """Для підтвердження від платіжної системи (callback у wallet.py)."""
    try:
        appointment_id = int(payment.provider_ref.split("-")[1])
    except (IndexError, ValueError):
        logger.warning("Чайові: невірний order_id %s", payment.provider_ref)
        return
    a = await db.get(Appointment, appointment_id)
    payment.status = "completed"
    payment.completed_at = utc_now()
    if a:
        apply_tip(a, Decimal(payment.amount))
