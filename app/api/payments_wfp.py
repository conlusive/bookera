"""
WayForPay: підтвердження оплати й повернення клієнта.

  POST     /payments/wayforpay/callback  - WayForPay повідомляє, що оплата пройшла
  GET|POST /payments/return?to=...       - WayForPay повертає клієнта після оплати

Один прийом для всього, що оплачується через WayForPay (крім підписки -
у неї свій): tip-... - чайові майстрові, gc-... - подарункова картка.

Захист:
  - підпис запиту (verify_callback_signature)
  - сума звіряється з тією, що ми самі виставили: оплату на 1 ₴ не видати
    за повну
  - повторне підтвердження - звична річ, нічого не змінює
  - повернення - лише на наш сайт (FRONTEND_URL), інакше це був би
    «відкритий редирект» для фішингу
"""
import json
import os
from decimal import Decimal
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging_config import logger
from app.core.time_utils import utc_now
from app.models.monetization import GiftCertificate, Payment
from app.services.payments import verify_callback_signature, wayforpay_accept

router = APIRouter(tags=["Payments"])


async def _read_payload(request: Request) -> dict:
    """
    WayForPay надсилає JSON, але не завжди з типом application/json:
    буває form-urlencoded, де весь JSON - це ключ. Розбираємо обидва.
    """
    raw = (await request.body()).decode("utf-8", errors="replace").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except ValueError:
        pass
    form = parse_qs(raw, keep_blank_values=True)
    if len(form) == 1:
        key = next(iter(form))
        try:
            data = json.loads(key)
            if isinstance(data, dict):
                return data
        except ValueError:
            pass
    return {k: v[0] for k, v in form.items()}


@router.post("/payments/wayforpay/callback")
async def wayforpay_callback(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await _read_payload(request)
    order_id = str(payload.get("orderReference") or "")
    if not order_id.startswith(("tip-", "gc-", "rb-", "sub-")):
        raise HTTPException(status_code=400, detail="Невідомий платіж")
    if not verify_callback_signature(payload):
        logger.warning("WayForPay: невірний підпис для %s", order_id)
        raise HTTPException(status_code=400, detail="Невірний підпис")

    payment = (await db.execute(select(Payment).where(Payment.provider_ref == order_id))).scalars().first()
    if not payment:
        raise HTTPException(status_code=404, detail="Платіж не знайдено")
    if payment.status == "completed":
        return wayforpay_accept(order_id)

    paid = payload.get("amount")
    if paid is not None and Decimal(str(paid)) != Decimal(payment.amount):
        logger.warning("WayForPay: сума %s не збігається з виставленою %s (%s)", paid, payment.amount, order_id)
        raise HTTPException(status_code=400, detail="Сума не збігається")

    status = str(payload.get("transactionStatus") or "")
    if status == "Approved":
        if order_id.startswith("tip-"):
            from app.api.feedback import complete_tip_payment
            await complete_tip_payment(db, payment)
        elif order_id.startswith("sub-"):
            from app.api.platform import complete_subscription_payment
            await complete_subscription_payment(db, payment)
        elif order_id.startswith("rb-"):
            from app.api.crm.monetization import complete_radar_payment
            await complete_radar_payment(db, payment)
        else:
            payment.status = "completed"
            payment.completed_at = utc_now()
            cert = (await db.execute(select(GiftCertificate).where(GiftCertificate.payment_id == payment.id))).scalars().first()
            if cert:
                cert.status = "active"
    elif status in ("Declined", "Expired", "Refunded", "Voided"):
        payment.status = "failed"
    # InProcessing / WaitingAuthComplete - ще чекаємо наступного підтвердження
    await db.commit()
    return wayforpay_accept(order_id)


def _safe_target(to: str) -> str:
    """Лише наш сайт; усе інше - на головну."""
    base = os.getenv("FRONTEND_URL", "").rstrip("/")
    if not base:
        return to if to.startswith("/") and not to.startswith("//") else "/"
    if to.startswith("/") and not to.startswith("//"):
        return base + to
    b, t = urlparse(base), urlparse(to)
    if t.scheme == b.scheme and t.netloc == b.netloc:
        return to
    return base


@router.api_route("/payments/return", methods=["GET", "POST"])
async def payment_return(to: str = Query("/")):
    """
    Після оплати WayForPay повертає клієнта POST-запитом - сторінка сайту
    такий запит прийняти не може. Тому повертаємо сюди, а звідси -
    звичайним переходом (303) на потрібну сторінку сайту.
    """
    return RedirectResponse(_safe_target(to), status_code=303)
