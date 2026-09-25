"""
Бонуси BookEra - нарахування за завершені візити.

3% від вартості візиту, округлено вниз до цілого бонуса (1 бонус = 1 ₴).
Ставку можна змінити змінною оточення BONUS_RATE без переписування коду.

Нараховуються, коли візит стає завершеним, - у будь-якому з трьох місць,
де це відбувається (CRM, загальний маршрут статусу, автозавершення).
Якщо позначку «завершено» зняли - бонус повертається окремим записом,
а не видаляється: історія лишається чесною.
"""
import os
from decimal import Decimal, ROUND_DOWN
from typing import Optional, Tuple

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import logger
from app.models.monetization import ClientBonusEntry

BONUS_RATE = Decimal(os.getenv("BONUS_RATE", "0.03"))


def phone_tail(phone: Optional[str]) -> Optional[str]:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    return digits[-9:] if len(digits) >= 9 else None


def owner_of(appointment) -> Tuple[Optional[str], Optional[str]]:
    email = (appointment.client_email or "").strip().lower() or None
    return email, phone_tail(appointment.client_phone)


async def sync_visit_bonus(db: AsyncSession, appointment, old_status: Optional[str]) -> None:
    """Викликати ПІСЛЯ зміни статусу візиту. Сам нічого не комітить."""
    new_status = appointment.status
    if old_status == new_status:
        return

    email, tail = owner_of(appointment)
    if not email and not tail:
        return  # немає кому нараховувати

    existing = await db.execute(
        select(ClientBonusEntry.reason, ClientBonusEntry.amount)
        .where(ClientBonusEntry.appointment_id == appointment.id)
    )
    by_reason = {r: a for r, a in existing.all()}

    try:
        if new_status == "completed" and "visit_completed" not in by_reason:
            price = Decimal(str(appointment.price or 0))
            amount = int((price * BONUS_RATE).quantize(Decimal("1"), rounding=ROUND_DOWN))
            if amount > 0:
                db.add(ClientBonusEntry(
                    client_email=email, client_phone_tail=tail, amount=amount,
                    reason="visit_completed", appointment_id=appointment.id,
                    business_id=appointment.business_id,
                ))

        elif old_status == "completed" and "visit_completed" in by_reason and "visit_reversed" not in by_reason:
            db.add(ClientBonusEntry(
                client_email=email, client_phone_tail=tail, amount=-by_reason["visit_completed"],
                reason="visit_reversed", appointment_id=appointment.id,
                business_id=appointment.business_id,
            ))
    except Exception as exc:
        # Бонус - не причина зривати зміну статусу візиту.
        logger.warning("Бонус за візит %s не нараховано: %s", appointment.id, exc)


def owner_filter(email: Optional[str], tail: Optional[str]):
    conds = []
    if email:
        conds.append(func.lower(ClientBonusEntry.client_email) == email.lower())
    if tail:
        conds.append(ClientBonusEntry.client_phone_tail == tail)
    return or_(*conds) if conds else None
