from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func

from app.api.deps import get_db
from app.models.user import Business, User, RoleEnum, Appointment
from app.schemas import BusinessOut

router = APIRouter(prefix="/businesses", tags=["Businesses"])

LOCK_TIMEOUT_MINUTES = 10


def get_utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_time_period(period: Optional[str]):
    if period == "Ранок":
        return time(8, 0), time(12, 0)
    elif period == "Обід":
        return time(12, 0), time(17, 0)
    elif period == "Вечір":
        return time(17, 0), time(23, 0)
    return time(8, 0), time(23, 0)


@router.get(
    "/search-available",
    response_model=List[BusinessOut],
    summary="Пошук закладів із вільними слотами на обрану дату та час",
)
async def search_available_businesses(
    city: str = Query("Львів", description="Місто пошуку"),
    target_date: date = Query(..., description="Обрана дата (YYYY-MM-DD)"),
    time_period: Optional[str] = Query("Будь-коли", description="Ранок, Обід, Вечір або Будь-коли"),
    category: Optional[str] = Query("all", description="Категорія послуги"),
    db: AsyncSession = Depends(get_db),
):
    now = get_utc_now()
    period_start, period_end = parse_time_period(time_period)

    stmt = select(Business).where(func.lower(Business.city).like(f"%{city.lower()}%"))
    if category and category != "all":
        stmt = stmt.where(func.lower(Business.category).like(f"%{category.lower()}%"))

    result = await db.execute(stmt)
    businesses = result.scalars().all()

    if not businesses:
        return []

    available_businesses = []

    for biz in businesses:
        masters_stmt = select(User).where(
            User.business_id == biz.id,
            User.role == RoleEnum.master
        )
        masters_res = await db.execute(masters_stmt)
        masters = masters_res.scalars().all()

        if not masters:
            continue

        day_start = datetime.combine(target_date, time(0, 0))
        day_end = datetime.combine(target_date, time(23, 59, 59))

        bookings_stmt = select(Appointment).where(
            Appointment.business_id == biz.id,
            Appointment.start_time >= day_start,
            Appointment.start_time <= day_end,
            or_(
                Appointment.status == "confirmed",
                and_(
                    Appointment.status == "blocked",
                    Appointment.expires_at > now
                )
            )
        )
        bookings_res = await db.execute(bookings_stmt)
        existing_bookings = bookings_res.scalars().all()

        current_slot = datetime.combine(target_date, period_start)
        period_end_dt = datetime.combine(target_date, period_end)

        has_free_slot = False

        while current_slot + timedelta(minutes=30) <= period_end_dt:
            slot_start = current_slot
            slot_end = current_slot + timedelta(minutes=30)

            if target_date == now.date() and slot_start < now:
                current_slot += timedelta(minutes=30)
                continue

            for master in masters:
                is_busy = any(
                    b.master_id == master.id and
                    b.start_time < slot_end and
                    b.end_time > slot_start
                    for b in existing_bookings
                )
                if not is_busy:
                    has_free_slot = True
                    break

            if has_free_slot:
                break

            current_slot += timedelta(minutes=30)

        if has_free_slot:
            available_businesses.append(biz)

    return available_businesses


@router.get("/{slug_or_id}", response_model=BusinessOut)
async def get_business_by_slug_or_id(
    slug_or_id: str,
    db: AsyncSession = Depends(get_db),
):
    if slug_or_id.isdigit():
        stmt = select(Business).where(Business.id == int(slug_or_id))
    else:
        stmt = select(Business).where(Business.slug == slug_or_id)

    result = await db.execute(stmt)
    business = result.scalars().first()

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заклад не знайдено"
        )

    return business