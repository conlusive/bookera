from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from app.api.deps import get_db
from app.core.time_utils import utc_now
from app.models import Business, User, RoleEnum, Appointment, Service, RadarBoost
from app.schemas.business import BusinessOut

router = APIRouter(prefix="/businesses", tags=["Businesses"])


def get_utc_now():
    return utc_now()


def parse_time_period(period: Optional[str]):
    if period == "Ранок":
        return time(8, 0), time(12, 0)
    elif period == "Обід":
        return time(12, 0), time(17, 0)
    elif period == "Вечір":
        return time(17, 0), time(23, 0)
    return time(8, 0), time(23, 0)


@router.get("/", response_model=List[BusinessOut])
async def list_businesses(
    limit: int = Query(50, ge=1, le=200, description="Максимум записів (за замовчуванням 50, ліміт 200)"),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    # Бізнеси з активним radar-бустом підіймаються вище (аналог "піднято" на OLX) -
    # підзапит перевіряє наявність не протермінованого активного буста.
    radar_subq = (
        select(RadarBoost.business_id)
        .where(RadarBoost.status == "active", RadarBoost.expires_at > utc_now())
        .subquery()
    )
    stmt = (
        select(Business)
        .where(Business.is_active == True)
        .options(selectinload(Business.services))
        .order_by(Business.id.in_(select(radar_subq.c.business_id)).desc(), Business.id)
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


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
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    now = get_utc_now()
    period_start, period_end = parse_time_period(time_period)

    stmt = (
        select(Business)
        .where(
            Business.is_active == True,
            func.lower(Business.city).like(f"%{city.lower()}%")
        )
        .options(selectinload(Business.services))
    )
    if category and category != "all":
        stmt = stmt.where(func.lower(Business.category).like(f"%{category.lower()}%"))
    stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    businesses = result.scalars().all()

    if not businesses:
        return []

    # Батчимо запити замість N+1: раніше на кожен заклад з результатів
    # виконувалось 2 окремих запити в базу (майстри + бронювання) в циклі.
    # При 100 закладах у видачі це 200 зайвих round-trip'ів на один пошук -
    # саме те, що першим лягає під навантаженням. Тепер - рівно 2 запити всього.
    business_ids = [biz.id for biz in businesses]

    masters_stmt = select(User).where(
        User.business_id.in_(business_ids),
        or_(User.role == RoleEnum.MASTER, User.role == RoleEnum.VENDOR),
    )
    masters_res = await db.execute(masters_stmt)
    masters_by_business: dict = {}
    for m in masters_res.scalars().all():
        masters_by_business.setdefault(m.business_id, []).append(m)

    day_start = datetime.combine(target_date, time(0, 0))
    day_end = datetime.combine(target_date, time(23, 59, 59))

    bookings_stmt = select(Appointment).where(
        Appointment.business_id.in_(business_ids),
        Appointment.start_time >= day_start,
        Appointment.start_time <= day_end,
        or_(
            Appointment.status == "confirmed",
            and_(Appointment.status == "blocked", Appointment.expires_at > now),
        ),
    )
    bookings_res = await db.execute(bookings_stmt)
    bookings_by_business: dict = {}
    for b in bookings_res.scalars().all():
        bookings_by_business.setdefault(b.business_id, []).append(b)

    available_businesses = []

    for biz in businesses:
        masters = masters_by_business.get(biz.id, [])
        existing_bookings = bookings_by_business.get(biz.id, [])

        current_slot = datetime.combine(target_date, period_start)
        period_end_dt = datetime.combine(target_date, period_end)

        has_free_slot = False

        while current_slot + timedelta(minutes=30) <= period_end_dt:
            slot_start = current_slot
            slot_end = current_slot + timedelta(minutes=30)

            if target_date == now.date() and slot_start < now:
                current_slot += timedelta(minutes=30)
                continue

            if not masters:
                # Якщо окремих майстрів не заведено, рахуємо сам заклад як майстра
                is_busy = any(
                    b.start_time < slot_end and b.end_time > slot_start
                    for b in existing_bookings
                )
                if not is_busy:
                    has_free_slot = True
                    break
            else:
                for master in masters:
                    is_busy = any(
                        b.master_id == str(master.id) and
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
    stmt = (
        select(Business)
        .options(selectinload(Business.services))
    )
    if slug_or_id.isdigit():
        stmt = stmt.where(Business.id == int(slug_or_id))
    else:
        stmt = stmt.where(Business.slug == slug_or_id)

    result = await db.execute(stmt)
    business = result.scalars().first()

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заклад не знайдено"
        )

    return business