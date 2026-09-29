"""
Статистика клієнта - з ЗАПИСІВ, а не зі збережених лічильників.

У clients є поля visits_count, total_spent, last_visit_at, але їх ніхто
ніколи не оновлював: у вкладці «Клієнти» в усіх було 0 візитів і 0 ₴,
сегменти «постійні» / «давно не були» не працювали, розсилка «постійним»
не знаходила нікого, а «давно не були» падала (зверталась до неіснуючого
поля last_visit). Тепер - рахується щоразу, тож завжди правдиве.

Звʼязок запису з клієнтом: client_id, а для записів без нього (старі
онлайн-записи) - за останніми 9 цифрами телефону.
"""
from datetime import datetime
from decimal import Decimal
from typing import Dict, Iterable, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time_utils import local_now
from app.models import Appointment


def phone_tail(phone: Optional[str]) -> Optional[str]:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    return digits[-9:] if len(digits) >= 9 else None


def _empty() -> dict:
    return {"visits_count": 0, "total_spent": 0.0, "last_visit_at": None, "next_visit_at": None, "no_show_count": 0}


async def client_stats(db: AsyncSession, business_id: int, clients: Iterable) -> Dict[int, dict]:
    clients = list(clients)
    out: Dict[int, dict] = {c.id: _empty() for c in clients}
    if not clients:
        return out
    now = local_now().replace(tzinfo=None)
    ids = list(out)
    by_tail = {phone_tail(c.phone): c.id for c in clients if phone_tail(c.phone)}

    def merge(cid, done, spent, last, noshow, nxt):
        s = out[cid]
        s["visits_count"] += int(done or 0)
        s["total_spent"] += float(spent or 0)
        s["no_show_count"] += int(noshow or 0)
        if last and (s["last_visit_at"] is None or last > s["last_visit_at"]):
            s["last_visit_at"] = last
        if nxt and (s["next_visit_at"] is None or nxt < s["next_visit_at"]):
            s["next_visit_at"] = nxt

    completed = Appointment.status == "completed"
    upcoming = Appointment.status.in_(["confirmed", "pending_approval"]) & (Appointment.start_time > now)
    aggregates = (
        func.count(Appointment.id).filter(completed),
        func.coalesce(func.sum(Appointment.price).filter(completed), 0),
        func.max(Appointment.start_time).filter(completed),
        func.count(Appointment.id).filter(Appointment.status == "no-show"),
        func.min(Appointment.start_time).filter(upcoming),
    )

    # 1. Записи, привʼязані до клієнта
    rows = (await db.execute(
        select(Appointment.client_id, *aggregates)
        .where(Appointment.business_id == business_id, Appointment.client_id.in_(ids))
        .group_by(Appointment.client_id)
    )).all()
    for cid, *agg in rows:
        merge(cid, *agg)

    # 2. Записи без client_id - за телефоном
    if by_tail:
        rows = (await db.execute(
            select(Appointment.client_phone, *aggregates)
            .where(Appointment.business_id == business_id, Appointment.client_id.is_(None), Appointment.client_phone.isnot(None))
            .group_by(Appointment.client_phone)
        )).all()
        for phone, *agg in rows:
            cid = by_tail.get(phone_tail(phone))
            if cid:
                merge(cid, *agg)

    for s in out.values():
        s["total_spent"] = round(s["total_spent"], 2)
    return out


def apply_stats(response, stats: Optional[dict]):
    """Покласти пораховане у відповідь (ClientResponse)."""
    s = stats or _empty()
    for k, v in s.items():
        setattr(response, k, v)
    return response
