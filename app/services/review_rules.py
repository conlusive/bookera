"""
Хто може лишити відгук - ОДНЕ місце для сервера (створення) і для списку візитів
(щоб сторінка салону не пропонувала оцінку, яку сервер однаково відхилить).

Відгуки - це довіра клієнтів, тому накрутка закрита:
  1) візит, який вніс у календар сам заклад (ручний запис, запис від імені
     персоналу), оцінити не можна - клієнтом тут міг бути хто завгодно;
  2) власник, адміністратор і майстри не оцінюють власний заклад
     (збіг пошти або телефону з будь-ким із команди);
  3) одна людина - один відгук на заклад раз на REVIEW_COOLDOWN_DAYS: десять
     «візитів» поспіль не дають десяти відгуків.
"""
from datetime import timedelta
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time_utils import utc_now
from app.models import Appointment, Business, StaffMembership, User

REVIEW_COOLDOWN_DAYS = 14


def _digits9(phone: Optional[str]) -> Optional[str]:
    d = "".join(ch for ch in (phone or "") if ch.isdigit())
    return d[-9:] if len(d) >= 9 else None


async def team_identities(db: AsyncSession, business_id: int) -> tuple[set[str], set[str]]:
    """Пошти й телефони (останні 9 цифр) усіх, хто працює в закладі, включно з власником."""
    biz = await db.get(Business, business_id)
    ids = {str(biz.owner_id)} if biz and biz.owner_id else set()
    rows = await db.execute(select(StaffMembership.user_id).where(StaffMembership.business_id == business_id))
    ids.update(str(r[0]) for r in rows.all())
    rows = await db.execute(select(User.id).where(User.business_id == business_id))
    ids.update(str(r[0]) for r in rows.all())
    emails: set[str] = set()
    phones: set[str] = set()
    if ids:
        users = await db.execute(select(User).where(User.id.in_(ids)))
        for u in users.scalars().all():
            if u.email:
                emails.add(u.email.strip().lower())
            p = _digits9(getattr(u, "phone", None))
            if p:
                phones.add(p)
    return emails, phones


async def review_block_reason(
    db: AsyncSession, appointment: Appointment, team: Optional[tuple[set[str], set[str]]] = None
) -> Optional[str]:
    """Чому цей візит оцінити не можна (текст для людини) або None, якщо можна."""
    if appointment.source == "manual" or appointment.created_by_staff_id:
        return "Оцінити можна візит, який ви самі забронювали онлайн"

    emails, phones = team if team is not None else await team_identities(db, appointment.business_id)
    email = (appointment.client_email or "").strip().lower()
    phone = _digits9(appointment.client_phone)
    if (email and email in emails) or (phone and phone in phones):
        return "Власники й працівники закладу не можуть оцінювати власний заклад"

    from app.models.extras import Review
    same_person = []
    if email:
        same_person.append(func.lower(Appointment.client_email) == email)
    if phone:
        same_person.append(Appointment.client_phone.like(f"%{phone}"))
    if same_person:
        since = utc_now() - timedelta(days=REVIEW_COOLDOWN_DAYS)
        last = (await db.execute(
            select(func.max(Review.created_at))
            .join(Appointment, Appointment.id == Review.appointment_id)
            .where(Review.business_id == appointment.business_id, Review.created_at >= since, or_(*same_person))
        )).scalar()
        if last:
            left = REVIEW_COOLDOWN_DAYS - (utc_now() - last).days
            return f"Ви вже залишали відгук цьому закладу нещодавно. Новий можна буде за {max(1, left)} дн."
    return None
