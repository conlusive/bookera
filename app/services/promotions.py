"""
Акції: яка знижка діє на цей візит.

Знижка залежить від послуги, дня тижня, години ПОЧАТКУ візиту й дати. Якщо під візит підходить кілька акцій,
діє найбільша (знижки не складаються). Рахується на сервері при записі й для підказки в формі запису
(GET /public/quote) - за одним і тим самим правилом, тож ціна в формі збігається з ціною запису.
"""
from datetime import date, datetime, time
from decimal import Decimal
from typing import Iterable, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Promotion

WEEKDAYS = ("пн", "вт", "ср", "чт", "пт", "сб", "нд")


def _t(value: Optional[str]) -> Optional[time]:
    if not value:
        return None
    try:
        h, m = str(value).split(":")[:2]
        return time(int(h), int(m))
    except (ValueError, TypeError):
        return None


def applies(p: Promotion, service_id: Optional[int], start: datetime) -> bool:
    if not p.is_active:
        return False
    if p.service_ids and (service_id is None or int(service_id) not in {int(x) for x in p.service_ids}):
        return False
    if p.date_from and start.date() < p.date_from:
        return False
    if p.date_to and start.date() > p.date_to:
        return False
    if p.weekdays and start.weekday() not in {int(x) for x in p.weekdays}:
        return False
    a, b = _t(p.time_from), _t(p.time_to)
    if a and b:
        t = start.time()
        inside = (a <= t < b) if a < b else (t >= a or t < b)  # вікно через північ: 22:00-02:00
        if not inside:
            return False
    return True


def best_for(promos: Iterable[Promotion], service_id: Optional[int], start: datetime) -> Optional[Promotion]:
    best = None
    for p in promos:
        if applies(p, service_id, start) and (best is None or p.discount_percent > best.discount_percent):
            best = p
    return best


def discounted(price: Decimal, percent: int) -> Decimal:
    return (Decimal(price) * (Decimal(100) - Decimal(percent)) / Decimal(100)).quantize(Decimal("0.01"))


def label(p: Promotion) -> str:
    """Коротко людською мовою: «−50% щодня 08:00-10:00»."""
    parts = [f"−{p.discount_percent}%"]
    if p.weekdays and len(set(p.weekdays)) < 7:
        days = sorted({int(x) for x in p.weekdays})
        parts.append(", ".join(WEEKDAYS[d] for d in days))
    elif _t(p.time_from) and _t(p.time_to):
        parts.append("щодня")
    if _t(p.time_from) and _t(p.time_to):
        parts.append(f"{p.time_from}-{p.time_to}")
    return " ".join(parts)


async def active_promotions(db: AsyncSession, business_id: int) -> List[Promotion]:
    today = date.today()
    rows = (await db.execute(select(Promotion).where(Promotion.business_id == business_id, Promotion.is_active.is_(True)))).scalars().all()
    return [p for p in rows if not (p.date_to and p.date_to < today)]
