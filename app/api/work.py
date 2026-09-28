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
from pydantic import BaseModel, Field
import re

from fastapi import APIRouter, Depends, HTTPException, Query
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
    # Лише один заклад - для вкладки «Моя робота» в кабінеті майстра.
    # Без параметра - усі салони разом, як у профілі.
    business_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    me = str(current_user.id)
    user = (await db.execute(select(User).where(User.id == me))).scalars().first()

    rows = (await db.execute(
        select(StaffMembership, Business)
        .join(Business, Business.id == StaffMembership.business_id)
        .where(
            StaffMembership.user_id == me,
            StaffMembership.is_active.is_(True),
            *([StaffMembership.business_id == business_id] if business_id else []),
        )
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
        select(func.avg(func.coalesce(Review.master_rating, Review.rating)), func.count(Review.id))
        .join(Appointment, Appointment.id == Review.appointment_id)
        .where(Appointment.master_id == me, Appointment.business_id.in_(biz_ids))
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
        select(StaffPayout).where(StaffPayout.staff_id == me, StaffPayout.status != "cancelled",
                                  StaffPayout.business_id.in_(biz_ids))
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



# --- Календар і особистий час майстра ---------------------------------

async def _my_membership(db: AsyncSession, me: str, business_id: int):
    from app.models import StaffMembership
    m = (await db.execute(select(StaffMembership).where(
        StaffMembership.user_id == me, StaffMembership.business_id == business_id,
        StaffMembership.is_active.is_(True),
    ))).scalars().first()
    if not m:
        raise HTTPException(status_code=403, detail="Ви не працюєте в цьому закладі")
    return m


@router.get("/me/calendar")
async def my_calendar(
    business_id: int = Query(...),
    month: str = Query(..., description="YYYY-MM"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Скільки моїх записів у кожен день місяця - для крапок у календарику."""
    me = str(current_user.id)
    await _my_membership(db, me, business_id)
    try:
        y, mo = (int(x) for x in month.split("-"))
        first = datetime(y, mo, 1)
    except Exception:
        raise HTTPException(status_code=400, detail="Місяць у форматі YYYY-MM")
    nxt = datetime(y + (mo == 12), 1 if mo == 12 else mo + 1, 1)
    rows = (await db.execute(
        select(func.date(Appointment.start_time), func.count(Appointment.id))
        .where(Appointment.master_id == me, Appointment.business_id == business_id,
               Appointment.start_time >= first, Appointment.start_time < nxt,
               Appointment.status.notin_(["cancelled", "no-show", "blocked", "time_off"]))
        .group_by(func.date(Appointment.start_time))
    )).all()
    return {str(d): n for d, n in rows}


@router.get("/me/agenda")
async def my_agenda(
    business_id: int = Query(...),
    date_: str = Query(..., alias="date", description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Мої записи й особистий час на день - по порядку."""
    me = str(current_user.id)
    await _my_membership(db, me, business_id)
    try:
        day = datetime.strptime(date_, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Дата у форматі YYYY-MM-DD")
    items = (await db.execute(
        select(Appointment).where(
            Appointment.master_id == me, Appointment.business_id == business_id,
            Appointment.start_time >= day, Appointment.start_time < day + timedelta(days=1),
            Appointment.status.notin_(["cancelled", "blocked"]),
        ).order_by(Appointment.start_time)
    )).scalars().all()
    srv_ids = {a.service_id for a in items if a.service_id}
    names = {}
    if srv_ids:
        names = {s.id: s.name for s in (await db.execute(select(Service).where(Service.id.in_(srv_ids)))).scalars().all()}
    return [{
        "id": a.id, "status": a.status,
        "start_time": a.start_time.isoformat(), "end_time": a.end_time.isoformat() if a.end_time else None,
        "service_name": names.get(a.service_id), "client_name": a.client_name,
        "client_phone": a.client_phone, "price": float(a.price) if a.price is not None else None,
        "note": a.notes if hasattr(a, "notes") else None,
    } for a in items]


class TimeOffIn(BaseModel):
    business_id: int
    start_time: datetime
    end_time: datetime
    note: Optional[str] = Field(default=None, max_length=120)


@router.post("/me/time-off")
async def add_time_off(
    payload: TimeOffIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Особистий час майстра: перерва, справи, лікар. Для клієнтів цей час
    зайнятий, у календарі закладу - видно, чому.

    Не перекриває записи клієнтів: якщо на цей час уже хтось записаний,
    спершу треба домовитись із клієнтом і перенести запис.
    """
    me = str(current_user.id)
    await _my_membership(db, me, payload.business_id)
    start = payload.start_time.replace(tzinfo=None, second=0, microsecond=0)
    end = payload.end_time.replace(tzinfo=None, second=0, microsecond=0)
    if end <= start:
        raise HTTPException(status_code=400, detail="Кінець має бути пізніше за початок")
    if end - start > timedelta(days=14):
        raise HTTPException(status_code=400, detail="Не більше двох тижнів за раз")

    clash = (await db.execute(select(Appointment).where(
        Appointment.master_id == me, Appointment.business_id == payload.business_id,
        Appointment.status.in_(["confirmed", "pending_approval"]),
        Appointment.start_time < end, Appointment.end_time > start,
    ))).scalars().first()
    if clash:
        raise HTTPException(status_code=409, detail=f"На цей час уже є запис о {clash.start_time.strftime('%H:%M')} - спершу перенесіть його")

    block = Appointment(
        business_id=payload.business_id, master_id=me, start_time=start, end_time=end,
        status="time_off", client_name=(payload.note or "Особистий час").strip(), source="crm",
    )
    db.add(block)
    await db.commit()
    await db.refresh(block)
    return {"id": block.id, "start_time": block.start_time.isoformat(), "end_time": block.end_time.isoformat(), "note": block.client_name}


@router.delete("/me/time-off/{block_id}", status_code=204)
async def remove_time_off(
    block_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    block = await db.get(Appointment, block_id)
    if not block or block.status != "time_off" or str(block.master_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Не знайдено")
    await db.delete(block)
    await db.commit()




@router.get("/me/shifts")
async def get_my_shifts(
    business_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Мій тижневий графік - ТОЙ САМИЙ, що салон виставив у «Команді».

    Графік виставляє салон, майстер його бачить. Якщо власного графіка
    майстрові не задано - він працює в години закладу: саме так рахує
    вільні години й сервер (_on_shift), тож показуємо їх.

    source: "master" - графік задано саме цьому майстрові,
            "salon"  - години закладу.
    """
    me = str(current_user.id)
    membership = await _my_membership(db, me, business_id)
    days = ["Понеділок", "Вівторок", "Середа", "Четвер", "Пʼятниця", "Субота", "Неділя"]

    # Графік У ЦЬОМУ ЗАКЛАДІ.
    shifts = membership.shifts
    if isinstance(shifts, str):
        import json
        try:
            shifts = json.loads(shifts)
        except Exception:
            shifts = None
    if isinstance(shifts, list) and len(shifts) == 7:
        return {"source": "master", "shifts": [
            {"day": days[i], "active": bool(s.get("active", True)),
             "start": str(s.get("start") or "09:00")[:5], "end": str(s.get("end") or "20:00")[:5]}
            for i, s in enumerate(shifts)
        ]}

    from app.models import BusinessHours
    hours = {h.weekday: h for h in (await db.execute(
        select(BusinessHours).where(BusinessHours.business_id == business_id)
    )).scalars().all()}
    return {"source": "salon", "shifts": [
        {"day": days[i],
         "active": bool(hours[i].is_open) if i in hours else i < 6,
         "start": str(hours[i].open_time)[:5] if i in hours and hours[i].open_time else "09:00",
         "end": str(hours[i].close_time)[:5] if i in hours and hours[i].close_time else "20:00"}
        for i in range(7)
    ]}
