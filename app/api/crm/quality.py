"""
Якість роботи майстрів.

  GET   /crm/businesses/{bid}/staff/{uid}/quality   - повний звіт по майстру
  GET   /crm/businesses/{bid}/staff-quality         - оцінки всієї команди (для списку)
  PATCH /crm/appointments/{id}/tip                  - записати чайові за візит

Оцінка якості (0-100) складається з трьох речей, які клієнт показує
своєю поведінкою, а не словами:
  рейтинг відгуків        50%   - що клієнти кажуть
  повернення клієнтів     35%   - чи приходять знову (найчесніший сигнал)
  частка візитів із чаями 15%   - чи були настільки задоволені, щоб подякувати
Поки завершених візитів менше за MIN_VISITS - оцінки немає: на трьох
візитах вона була б випадковою й несправедливою до нового майстра.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, assert_business_admin, get_current_user
from app.core.database import get_db
from app.core.time_utils import local_now
from app.models import Appointment, Business, Service, StaffMembership, User
from app.models.extras import Review

router = APIRouter(tags=["Staff quality"])

MIN_VISITS = 5
RETURN_WINDOW_DAYS = 60
WEIGHTS = {"rating": 0.50, "retention": 0.35, "tips": 0.15}


def _client_key(a: Appointment) -> Optional[str]:
    if a.client_id:
        return f"id:{a.client_id}"
    digits = "".join(ch for ch in (a.client_phone or "") if ch.isdigit())
    if len(digits) >= 9:
        return f"ph:{digits[-9:]}"
    if a.client_email:
        return f"em:{a.client_email.strip().lower()}"
    name = (a.client_name or "").strip().lower()
    return f"nm:{name}" if name else None


def _check_range(date_from: Optional[date], date_to: Optional[date]):
    """Обидві дати або жодної; від не пізніше до; не більше двох років."""
    if not date_from and not date_to:
        return None, None
    if not (date_from and date_to):
        raise HTTPException(status_code=400, detail="Вкажіть обидві дати періоду")
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="Початок періоду має бути раніше за кінець")
    if (date_to - date_from).days > 730:
        raise HTTPException(status_code=400, detail="Не більше двох років за раз")
    return date_from, date_to


async def _assert_admin_or_self(db: AsyncSession, current_user: CurrentUser, business_id: int, staff_id: str) -> None:
    """Власник чи адміністратор - будь-кого; майстер - лише себе."""
    if str(current_user.id) == str(staff_id):
        m = (await db.execute(select(StaffMembership).where(
            StaffMembership.user_id == str(current_user.id), StaffMembership.business_id == business_id,
            StaffMembership.is_active.is_(True),
        ))).scalars().first()
        if m:
            return
    await assert_business_admin(db, current_user, business_id)


async def compute_quality(db: AsyncSession, business_id: int, staff_id: str, days: int,
                          date_from: Optional[date] = None, date_to: Optional[date] = None) -> dict:
    # Період - або «останні N днів», або довільні дати (включно з обома).
    real_now = local_now().replace(tzinfo=None)
    if date_from and date_to:
        since = datetime.combine(date_from, datetime.min.time())
        now = min(real_now, datetime.combine(date_to + timedelta(days=1), datetime.min.time()))
        days = (date_to - date_from).days + 1
    else:
        now = real_now
        since = now - timedelta(days=days)

    # Усі завершені візити майстра в закладі - для повернень потрібна вся
    # історія, а не лише період: клієнт міг уперше прийти рік тому.
    all_done = (await db.execute(select(Appointment).where(
        Appointment.business_id == business_id, Appointment.master_id == str(staff_id),
        Appointment.status == "completed",
    ).order_by(Appointment.start_time))).scalars().all()
    period = [a for a in all_done if since <= a.start_time < now]
    period_all = (await db.execute(select(Appointment.status).where(
        Appointment.business_id == business_id, Appointment.master_id == str(staff_id),
        Appointment.start_time >= since, Appointment.start_time <= now,
        Appointment.status.in_(["completed", "no-show", "cancelled"]),
    ))).scalars().all()

    # --- Повернення клієнтів ---
    # Серед клієнтів, яких майстер обслужив за період, - частка тих, хто
    # прийшов до нього ще раз протягом 60 днів після візиту. Клієнтів,
    # у яких 60 днів ще не минуло й вони не повернулись, не рахуємо: вони
    # ще можуть повернутись, і вважати їх «втраченими» нечесно.
    visits_by_client = defaultdict(list)
    for a in all_done:
        k = _client_key(a)
        if k:
            visits_by_client[k].append(a.start_time)
    eligible = returned = 0
    period_clients = {_client_key(a) for a in period if _client_key(a)}
    for k in period_clients:
        times = visits_by_client[k]
        first_in_period = next(t for t in times if t >= since)
        later = [t for t in times if t > first_in_period]
        came_back = any((t - first_in_period).days <= RETURN_WINDOW_DAYS for t in later)
        if came_back:
            eligible += 1
            returned += 1
        # «Ще може повернутись» - від справжнього сьогодні, а не кінця періоду
        elif (real_now - first_in_period).days > RETURN_WINDOW_DAYS:
            eligible += 1
    retention = (returned / eligible) if eligible else None

    # --- Чайові ---
    tipped = [a for a in period if a.tip_amount and Decimal(str(a.tip_amount)) > 0]
    tips_total = sum((Decimal(str(a.tip_amount)) for a in tipped), Decimal("0"))
    tips_share = (len(tipped) / len(period)) if period else None

    # --- Відгуки ---
    rev_rows = (await db.execute(
        select(Review, Appointment.service_id)
        .join(Appointment, Appointment.id == Review.appointment_id)
        .where(Review.business_id == business_id, Appointment.master_id == str(staff_id))
        .order_by(Review.created_at.desc())
    )).all()
    ratings = [r.rating for r, _ in rev_rows if r.rating]
    period_ratings = [r.rating for r, _ in rev_rows if r.rating and r.created_at and since <= r.created_at < now]
    rating_avg = round(sum(ratings) / len(ratings), 2) if ratings else None
    distribution = {str(i): sum(1 for x in ratings if x == i) for i in range(1, 6)}
    srv_ids = {sid for _, sid in rev_rows if sid}
    srv_names = {s.id: s.name for s in (await db.execute(select(Service).where(Service.id.in_(srv_ids)))).scalars().all()} if srv_ids else {}

    # --- Оцінка ---
    score = None
    parts = {}
    if len(period) >= MIN_VISITS:
        parts["rating"] = ((rating_avg - 1) / 4) if rating_avg is not None else None
        parts["retention"] = retention
        parts["tips"] = tips_share
        known = {k: v for k, v in parts.items() if v is not None}
        if known:
            # Відсутні складові не тягнуть оцінку вниз: вага ділиться між наявними
            total_w = sum(WEIGHTS[k] for k in known)
            score = round(sum(WEIGHTS[k] * v for k, v in known.items()) / total_w * 100)

    no_show = sum(1 for s in period_all if s == "no-show")
    cancelled = sum(1 for s in period_all if s == "cancelled")
    return {
        "days": days,
        "date_from": since.date().isoformat(),
        "date_to": (now - timedelta(seconds=1)).date().isoformat(),
        "score": score,
        "enough_data": len(period) >= MIN_VISITS,
        "min_visits": MIN_VISITS,
        "visits": len(period),
        "rating": {"avg": rating_avg, "count": len(ratings), "period_count": len(period_ratings), "distribution": distribution},
        "retention": {
            "rate": round(retention, 3) if retention is not None else None,
            "returned": returned, "eligible": eligible, "clients": len(period_clients), "window_days": RETURN_WINDOW_DAYS,
        },
        "tips": {
            "total": float(tips_total), "count": len(tipped),
            "share": round(tips_share, 3) if tips_share is not None else None,
            "avg": float((tips_total / len(tipped)).quantize(Decimal("0.01"))) if tipped else 0,
        },
        "no_show_rate": round(no_show / len(period_all), 3) if period_all else None,
        "cancel_rate": round(cancelled / len(period_all), 3) if period_all else None,
        "reviews": [{
            "id": r.id, "rating": r.rating, "comment": r.comment, "author": r.author_name,
            "reply": r.business_reply, "service": srv_names.get(sid),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        } for r, sid in rev_rows[:50]],
    }


@router.get("/crm/businesses/{business_id}/staff/{staff_id}/quality")
async def staff_quality(
    business_id: int,
    staff_id: str,
    days: int = Query(90, ge=1, le=730),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await _assert_admin_or_self(db, current_user, business_id, staff_id)
    date_from, date_to = _check_range(date_from, date_to)
    data = await compute_quality(db, business_id, staff_id, days, date_from, date_to)

    # Порівняння з командою - лише для власника й адміністратора: майстрові
    # чужі показники не відкриваємо навіть у середньому.
    try:
        await assert_business_admin(db, current_user, business_id)
        team = await _team_scores(db, business_id, days, date_from, date_to)
        others = [t for t in team if t["staff_id"] != str(staff_id)]
        def avg(key):
            vals = [t[key] for t in others if t[key] is not None]
            return round(sum(vals) / len(vals), 3) if vals else None
        data["team"] = {"score": avg("score"), "rating": avg("rating"), "retention": avg("retention"), "tips_share": avg("tips_share"), "size": len(others)}
        ranked = sorted([t for t in team if t["score"] is not None], key=lambda t: -t["score"])
        data["rank"] = next((i + 1 for i, t in enumerate(ranked) if t["staff_id"] == str(staff_id)), None)
        data["ranked_of"] = len(ranked)
    except HTTPException:
        pass
    return data


async def _team_scores(db: AsyncSession, business_id: int, days: int, date_from=None, date_to=None) -> list:
    rows = (await db.execute(
        select(User).join(StaffMembership, StaffMembership.user_id == User.id).where(
            StaffMembership.business_id == business_id, StaffMembership.is_active.is_(True),
            StaffMembership.role.in_(["master", "admin", "vendor"]),
        ))).scalars().all()
    out = []
    for u in rows:
        q = await compute_quality(db, business_id, u.id, days, date_from, date_to)
        out.append({
            "staff_id": u.id, "score": q["score"], "rating": q["rating"]["avg"],
            "retention": q["retention"]["rate"], "tips_share": q["tips"]["share"], "visits": q["visits"],
        })
    return out


@router.get("/crm/businesses/{business_id}/staff-quality")
async def team_quality(
    business_id: int,
    days: int = Query(90, ge=1, le=730),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Оцінки всієї команди - для значків у списку «Команди»."""
    await assert_business_admin(db, current_user, business_id)
    date_from, date_to = _check_range(date_from, date_to)
    return await _team_scores(db, business_id, days, date_from, date_to)


class TipIn(BaseModel):
    amount: float = Field(ge=0, le=100000)


@router.patch("/crm/appointments/{appointment_id}/tip")
async def set_tip(
    appointment_id: int,
    payload: TipIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Чайові за візит. Власник і адміністратор - за будь-який візит, майстер -
    лише за свій. Лише для завершених: чайові за візит, якого ще не було,
    - помилка введення.
    """
    a = await db.get(Appointment, appointment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Запис не знайдено")
    if str(a.master_id or "") != str(current_user.id):
        await assert_business_admin(db, current_user, a.business_id)
    else:
        await _assert_admin_or_self(db, current_user, a.business_id, str(current_user.id))
    if a.status != "completed":
        raise HTTPException(status_code=409, detail="Чайові - лише за завершений візит")
    a.tip_amount = Decimal(str(round(payload.amount, 2))) if payload.amount else None
    from app.services.audit import record
    await record(db, a.business_id, str(current_user.id), "money", "tip_set",
                 f"Чайові {payload.amount:g} ₴ за візит {a.client_name or ''} {a.start_time:%d.%m}")
    await db.commit()
    return {"id": a.id, "tip_amount": float(a.tip_amount) if a.tip_amount is not None else None}
