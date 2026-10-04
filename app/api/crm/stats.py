from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_admin, get_current_user, assert_section
from app.core.time_utils import utc_now
from app.models import Appointment, Business, Client, Service
from app.services.analytics import build_analytics, month_progress

router = APIRouter(prefix="/crm/businesses", tags=["CRM - Stats"])


class TopServiceItem(BaseModel):
    service_id: int
    name: str
    bookings_count: int
    revenue: float


class BusinessStatsResponse(BaseModel):
    period_start: date
    period_end: date
    total_appointments: int
    completed_appointments: int
    cancelled_appointments: int
    upcoming_appointments: int
    revenue_completed: float
    revenue_expected: float
    new_clients: int
    top_services: List[TopServiceItem]


@router.get("/{business_id}/stats", response_model=BusinessStatsResponse)
async def get_business_stats(
    business_id: int,
    date_from: Optional[date] = Query(None, description="За замовчуванням - початок поточного місяця"),
    date_to: Optional[date] = Query(None, description="За замовчуванням - сьогодні"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_section(db, current_user, business_id, "analytics")

    today = utc_now().date()
    period_start = date_from or today.replace(day=1)
    period_end = date_to or today
    start_dt = datetime.combine(period_start, datetime.min.time())
    end_dt = datetime.combine(period_end, datetime.max.time())

    base_filter = (
        Appointment.business_id == business_id,
        Appointment.start_time >= start_dt,
        Appointment.start_time <= end_dt,
    )

    counts_stmt = select(Appointment.status, func.count(Appointment.id)).where(*base_filter).group_by(Appointment.status)
    counts_res = await db.execute(counts_stmt)
    counts_by_status = dict(counts_res.all())

    upcoming_stmt = select(func.count(Appointment.id)).where(
        Appointment.business_id == business_id,
        Appointment.status == "confirmed",
        Appointment.start_time > utc_now(),
    )
    upcoming_res = await db.execute(upcoming_stmt)
    upcoming_count = upcoming_res.scalar() or 0

    revenue_completed_stmt = select(func.coalesce(func.sum(Appointment.price), 0)).where(
        *base_filter, Appointment.status == "completed"
    )
    revenue_completed = (await db.execute(revenue_completed_stmt)).scalar() or 0

    revenue_expected_stmt = select(func.coalesce(func.sum(Appointment.price), 0)).where(
        *base_filter, Appointment.status.in_(["completed", "confirmed"])
    )
    revenue_expected = (await db.execute(revenue_expected_stmt)).scalar() or 0

    new_clients_stmt = select(func.count(Client.id)).where(
        Client.business_id == business_id,
        Client.created_at >= start_dt,
        Client.created_at <= end_dt,
    )
    new_clients = (await db.execute(new_clients_stmt)).scalar() or 0

    top_services_stmt = (
        select(Service.id, Service.name, func.count(Appointment.id), func.coalesce(func.sum(Appointment.price), 0))
        .join(Appointment, Appointment.service_id == Service.id)
        .where(*base_filter, Appointment.status.in_(["completed", "confirmed"]))
        .group_by(Service.id, Service.name)
        .order_by(func.count(Appointment.id).desc())
        .limit(5)
    )
    top_services_res = await db.execute(top_services_stmt)
    top_services = [
        TopServiceItem(service_id=sid, name=name, bookings_count=cnt, revenue=float(rev))
        for sid, name, cnt, rev in top_services_res.all()
    ]

    return BusinessStatsResponse(
        period_start=period_start,
        period_end=period_end,
        total_appointments=sum(counts_by_status.values()),
        completed_appointments=counts_by_status.get("completed", 0),
        cancelled_appointments=counts_by_status.get("cancelled", 0),
        upcoming_appointments=upcoming_count,
        revenue_completed=float(revenue_completed),
        revenue_expected=float(revenue_expected),
        new_clients=new_clients,
        top_services=top_services,
    )


# === Аналітика (вкладка «Аналітика») ===
# Усі цифри рахує app/services/analytics.py - браузер лише показує.

MAX_ANALYTICS_DAYS = 800


@router.get("/{business_id}/analytics")
async def get_analytics(
    business_id: int,
    date_from: Optional[date] = Query(None, description="За замовчуванням - початок поточного місяця"),
    date_to: Optional[date] = Query(None, description="За замовчуванням - сьогодні"),
    compare_from: Optional[date] = Query(None, description="Початок періоду порівняння"),
    compare_to: Optional[date] = Query(None, description="Кінець періоду порівняння"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_section(db, current_user, business_id, "analytics")
    from app.core.time_utils import local_now

    today = local_now().date()
    start = date_from or today.replace(day=1)
    end = date_to or today
    if (max(start, end) - min(start, end)).days > MAX_ANALYTICS_DAYS:
        raise HTTPException(status_code=400, detail=f"Період завеликий: не більше {MAX_ANALYTICS_DAYS} днів")

    data = await build_analytics(db, business_id, start, end, compare_from, compare_to)
    data["goal"] = await month_progress(db, business_id, await _read_goal(db, business_id))
    return data


async def _read_goal(db: AsyncSession, business_id: int) -> Optional[float]:
    from sqlalchemy.exc import DBAPIError
    try:
        value = (await db.execute(select(Business.monthly_revenue_goal).where(Business.id == business_id))).scalar()
    except DBAPIError:
        # Міграція ще не накочена: аналітика працює, просто без цілі.
        await db.rollback()
        return None
    return float(value) if value is not None else None


class GoalIn(BaseModel):
    amount: Optional[float] = None  # None / 0 - прибрати ціль


@router.put("/{business_id}/analytics/goal")
async def set_goal(
    business_id: int,
    payload: GoalIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Ціль доходу на місяць. Лише власник / адміністратор: це рішення про гроші закладу."""
    await assert_business_admin(db, current_user, business_id)
    amount = payload.amount
    if amount is not None and (amount < 0 or amount > 100_000_000):
        raise HTTPException(status_code=422, detail="Ціль має бути від 0 до 100 000 000 ₴")
    from sqlalchemy import update
    from sqlalchemy.exc import DBAPIError
    try:
        await db.execute(update(Business).where(Business.id == business_id).values(monthly_revenue_goal=amount or None))
        await db.commit()
    except DBAPIError:
        await db.rollback()
        raise HTTPException(status_code=503, detail="Потрібне оновлення бази даних (alembic upgrade head)")
    return await month_progress(db, business_id, amount or None)
