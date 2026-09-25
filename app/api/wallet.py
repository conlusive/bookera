"""
Гаманець клієнта: бонуси BookEra й подарункові картки.

  GET  /wallet/my                      - баланс бонусів, історія, мої картки
  POST /wallet/gift-cards              - купити картку закладу
  POST /wallet/gift-cards/callback     - підтвердження оплати від WayForPay
"""
import secrets
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db
from app.core.logging_config import logger
from app.core.time_utils import utc_now
from app.models import Business, User
from app.models.monetization import ClientBonusEntry, GiftCertificate, Payment
from app.services.bonuses import owner_filter, phone_tail
from app.services.payments import create_payment_intent, verify_callback_signature

router = APIRouter(prefix="/wallet", tags=["Wallet"])

GIFT_MIN, GIFT_MAX = 100, 20000
GIFT_VALID_DAYS = 365


async def _identity(db: AsyncSession, current_user: CurrentUser):
    """Пошта й телефон людини - так само, як /appointments/my."""
    res = await db.execute(select(User).where(User.id == str(current_user.id)))
    user = res.scalars().first()
    email = ((user.email if user else None) or current_user.email or "").strip().lower() or None
    tail = phone_tail(user.phone if user else None)
    return email, tail


def _card_out(cert: GiftCertificate, biz: Optional[Business], my_email: Optional[str], my_id: str) -> dict:
    received = bool(my_email and (cert.recipient_email or "").lower() == my_email and cert.purchaser_user_id != my_id)
    return {
        "id": cert.id,
        # Код - лише оплаченої картки: до оплати ним можна було б
        # розрахуватись, не заплативши.
        "code": cert.code if cert.status in ("active", "redeemed") else None,
        "status": cert.status,
        "initial_amount": float(cert.initial_amount),
        "remaining_amount": float(cert.remaining_amount),
        "business_id": cert.business_id,
        "business_name": biz.name if biz else None,
        "business_slug": biz.slug if biz else None,
        "recipient_name": cert.recipient_name,
        "message": cert.message,
        "direction": "received" if received else "bought",
        "expires_at": cert.expires_at.isoformat() if cert.expires_at else None,
        "created_at": cert.created_at.isoformat() if cert.created_at else None,
    }


@router.get("/my")
async def my_wallet(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    email, tail = await _identity(db, current_user)

    balance, history = 0, []
    cond = owner_filter(email, tail)
    if cond is not None:
        balance = (await db.execute(select(func.coalesce(func.sum(ClientBonusEntry.amount), 0)).where(cond))).scalar() or 0
        rows = await db.execute(
            select(ClientBonusEntry, Business.name)
            .outerjoin(Business, Business.id == ClientBonusEntry.business_id)
            .where(cond).order_by(ClientBonusEntry.created_at.desc()).limit(30)
        )
        history = [{
            "amount": e.amount, "reason": e.reason, "business_name": name,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        } for e, name in rows.all()]

    # Картки: куплені мною або подаровані мені.
    card_conds = [GiftCertificate.purchaser_user_id == str(current_user.id)]
    if email:
        card_conds.append(func.lower(GiftCertificate.recipient_email) == email)
        card_conds.append(func.lower(GiftCertificate.purchaser_email) == email)
    res = await db.execute(
        select(GiftCertificate, Business)
        .outerjoin(Business, Business.id == GiftCertificate.business_id)
        .where(or_(*card_conds), GiftCertificate.status != "cancelled")
        .order_by(GiftCertificate.created_at.desc())
    )
    cards = [_card_out(c, b, email, str(current_user.id)) for c, b in res.all()]

    return {"bonus_balance": int(balance), "bonus_history": history, "gift_cards": cards}


class GiftPurchase(BaseModel):
    business_id: int
    amount: int = Field(ge=GIFT_MIN, le=GIFT_MAX)
    recipient_name: Optional[str] = Field(default=None, max_length=80)
    recipient_email: Optional[EmailStr] = None
    message: Optional[str] = Field(default=None, max_length=300)


def _activate(cert: GiftCertificate, payment: Payment) -> None:
    payment.status = "completed"
    payment.completed_at = utc_now()
    cert.status = "active"


@router.post("/gift-cards")
async def buy_gift_card(
    payload: GiftPurchase,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Купівля подарункової картки закладу.

    Картка створюється зі статусом 'pending' і стає 'active' лише після
    підтвердження оплати. З тестовою оплатою (поки немає реквізитів
    WayForPay) підтвердження миттєве; зі справжньою - людину переводять
    на сторінку оплати, а картку активує /wallet/gift-cards/callback.
    """
    biz = await db.get(Business, payload.business_id)
    if not biz or not biz.is_active:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    email, _ = await _identity(db, current_user)
    amount = Decimal(payload.amount)
    order_id = f"gc-{uuid.uuid4().hex[:16]}"

    intent = create_payment_intent(amount, order_id, f"Подарункова картка {biz.name}")

    payment = Payment(
        business_id=biz.id, purpose="gift_certificate_purchase", amount=amount,
        provider=intent.provider, provider_ref=order_id, status="pending",
    )
    db.add(payment)
    await db.flush()

    cert = GiftCertificate(
        business_id=biz.id,
        code=secrets.token_hex(4).upper(),
        initial_amount=amount,
        remaining_amount=amount,
        status="pending",
        purchaser_email=email,
        purchaser_user_id=str(current_user.id),
        recipient_name=(payload.recipient_name or "").strip() or None,
        recipient_email=(str(payload.recipient_email).lower() if payload.recipient_email else None),
        message=(payload.message or "").strip() or None,
        expires_at=utc_now() + timedelta(days=GIFT_VALID_DAYS),
        payment_id=payment.id,
    )
    db.add(cert)

    if intent.status == "completed":
        _activate(cert, payment)

    await db.commit()
    await db.refresh(cert)
    return {"card": _card_out(cert, biz, email, str(current_user.id)), "checkout_url": intent.checkout_url}


@router.post("/gift-cards/callback")
async def gift_card_payment_callback(payload: dict, db: AsyncSession = Depends(get_db)):
    """
    Підтвердження оплати від платіжної системи - як для підписки.

    Захист - підпис запиту й звірка суми з тією, що ми самі виставили:
    довіряти сумі з тіла запиту не можна, інакше оплату на 1 гривню
    видали б за повну. Повторний виклик - звична річ, картку не чіпає.
    """
    order_id = str(payload.get("orderReference") or payload.get("order_id") or "")
    if not order_id.startswith("gc-"):
        raise HTTPException(status_code=400, detail="Невідомий платіж")
    if not verify_callback_signature(payload):
        logger.warning("Callback картки з невірним підписом: %s", order_id)
        raise HTTPException(status_code=400, detail="Невірний підпис запиту")

    payment = (await db.execute(select(Payment).where(Payment.provider_ref == order_id))).scalars().first()
    if not payment:
        raise HTTPException(status_code=404, detail="Платіж не знайдено")
    if payment.status == "completed":
        return {"status": "already_processed"}

    paid = payload.get("amount")
    if paid is not None and Decimal(str(paid)) != Decimal(payment.amount):
        logger.warning("Сума callback %s не збігається з виставленою %s", paid, payment.amount)
        raise HTTPException(status_code=400, detail="Сума не збігається")

    if str(payload.get("transactionStatus", "Approved")) != "Approved":
        payment.status = "failed"
        await db.commit()
        return {"status": "failed"}

    cert = (await db.execute(select(GiftCertificate).where(GiftCertificate.payment_id == payment.id))).scalars().first()
    if cert:
        _activate(cert, payment)
    else:
        payment.status = "completed"
        payment.completed_at = utc_now()
    await db.commit()
    return {"status": "ok"}
