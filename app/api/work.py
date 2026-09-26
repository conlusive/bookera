"""
«Моя робота» - кабінет майстра в особистому профілі.

Майстер, що працює в кількох салонах, раніше мусив заходити в кабінет
кожного окремо, щоб зрозуміти свій день. Тут усе разом: розклад на
сьогодні з усіх салонів, наступний клієнт, заробіток і виплати, рейтинг,
і швидкий перехід у кабінет потрібного салону.

Лише власні дані людини: її візити як майстра, її виплати, її салони.
"""
from collections import defaultdict
from datetime import datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db
from app.core.time_utils import local_now
from app.models import Appointment, Business, Service, StaffMembership, User
from app.models.extras import Review
from app.models.monetization import StaffPayout
from app.services.monetization import calculate_payout_preview

router = APIRouter(prefix="/work", tags=["Work"])

ROLE_LABELS = {"master": "Майстер", "admin": "Адміністратор", "business_owner": "Власник", "owner": "Власник"}


def _f(v) -> float:
    return float(v or 0)


@router.get("/me")
async def my_work(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    me = str(current_user.id)
    user = (await db.execute(select(User).where(User.id == me))).scalars().first()

    rows = (await db.execute(
        select(StaffMembership, Business)
        .join(Business, Business.id == StaffMembership.business_id)
        .where(StaffMembership.user_id == me, StaffMembership.is_active.is_(True))
        .order_by(Business.name)
    )).all()
    if not rows:
        return {"workplaces": []}

    biz_by_id = {b.id: b for _, b in rows}
    biz_ids = list(biz_by_id)

    now = local_now().replace(tzinfo=None)
    day_start = datetime.combine(now.date(), time.min)
    day_end = day_start + timedelta(days=1)
    month_ago = now - timedelta(days=30)
    fortnight_ago = day_start - timedelta(days=13)

    base = select(Appointment).where(
        Appointment.master_id == me,
        Appointment.business_id.in_(biz_ids),
    )

    # --- Сьогодні й найближче ---
    upcoming = (await db.execute(
        base.where(
            Appointment.start_time >= day_start,
            Appointment.start_time < now + timedelta(days=14),
            Appointment.status.notin_(["cancelled", "no-show"]),
        ).order_by(Appointment.start_time)
    )).scalars().all()

    srv_ids = {a.service_id for a in upcoming if a.service_id}
    services = {}
    if srv_ids:
        services = {s.id: s.name for s in (await db.execute(select(Service).where(Service.id.in_(srv_ids)))).scalars().all()}

    def appt_out(a: Appointment) -> dict:
        b = biz_by_id.get(a.business_id)
        return {
            "id": a.id,
            "business_id": a.business_id,
            "business_name": b.name if b else None,
            "start_time": a.start_time.isoformat(),
            "end_time": a.end_time.isoformat() if a.end_time else None,
            "service_name": services.get(a.service_id) if a.service_id else None,
            "client_name": a.client_name,
            "status": a.status,
        }

    today = [appt_out(a) for a in upcoming if a.start_time < day_end]
    next_up = next((appt_out(a) for a in upcoming if a.start_time >= now), None)

    # --- Останні 30 днів ---
    done = (await db.execute(
        base.where(Appointment.status == "completed", Appointment.start_time >= month_ago)
    )).scalars().all()
    revenue = sum(_f(a.price) for a in done)
    per_biz = defaultdict(lambda: {"visits": 0, "revenue": 0.0})
    for a in done:
        per_biz[a.business_id]["visits"] += 1
        per_biz[a.business_id]["revenue"] += _f(a.price)

    # Візити по днях за два тижні - для маленького графіка
    by_day = defaultdict(int)
    for a in done:
        if a.start_time >= fortnight_ago:
            by_day[a.start_time.date().isoformat()] += 1
    days = [(fortnight_ago + timedelta(days=i)).date().isoformat() for i in range(14)]

    # --- Рейтинг: відгуки на мої візити ---
    rating_row = (await db.execute(
        select(func.avg(Review.rating), func.count(Review.id))
        .join(Appointment, Appointment.id == Review.appointment_id)
        .where(Appointment.master_id == me)
    )).one()

    # --- Гроші: до виплати (де оплату налаштовано) й останні виплати ---
    unpaid = []
    if user and user.pay_configured_at:
        for m, b in rows:
            if str(b.owner_id) == me:
                continue  # власник зарплати не отримує
            preview = await calculate_payout_preview(db, b.id, me)
            amount = _f(preview.get("payout_amount"))
            if amount > 0:
                unpaid.append({"business_id": b.id, "business_name": b.name, "amount": round(amount, 2),
                               "since": preview["period_start"].isoformat() if preview.get("period_start") else None})

    payouts = (await db.execute(
        select(StaffPayout).where(StaffPayout.staff_id == me, StaffPayout.status != "cancelled")
        .order_by(StaffPayout.paid_at.desc()).limit(6)
    )).scalars().all()

    # Сьогоднішні записи по салонах - для карток салонів
    today_count = defaultdict(int)
    for t in today:
        today_count[t["business_id"]] += 1

    return {
        "workplaces": [{
            "business_id": b.id,
            "name": b.name,
            "slug": b.slug,
            "logo": b.logo,
            "city": b.city,
            "role": m.role,
            "role_label": ROLE_LABELS.get(m.role, "Член команди"),
            "is_current": user is not None and user.business_id == b.id,
            "today": today_count.get(b.id, 0),
            "visits_30d": per_biz[b.id]["visits"],
            "revenue_30d": round(per_biz[b.id]["revenue"], 2),
        } for m, b in rows],
        "today": today,
        "next": next_up,
        "stats_30d": {
            "visits": len(done),
            "revenue": round(revenue, 2),
            "avg_check": round(revenue / len(done), 2) if done else 0,
        },
        "daily": [{"date": d, "visits": by_day.get(d, 0)} for d in days],
        "rating": round(float(rating_row[0]), 1) if rating_row[0] is not None else None,
        "reviews": int(rating_row[1] or 0),
        "unpaid": unpaid,
        "payouts": [{
            "business_name": biz_by_id[p.business_id].name if p.business_id in biz_by_id else None,
            "amount": _f(p.payout_amount),
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            "appointments": p.appointments_count,
        } for p in payouts],
    }
