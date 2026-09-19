from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, delete
from sqlalchemy.orm import selectinload

from app.api.deps import get_db
from app.core.auth import CurrentUser, get_current_user
from app.core.time_utils import utc_now
from app.models import Business, User, RoleEnum, Appointment, Service, RadarBoost, BusinessHours, Favorite
from app.schemas.business import BusinessOut, WorkingDayOut

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
        .where(
            Business.is_active == True,
            # Заклади без чинної підписки в каталозі не показуємо: вони
            # однаково не приймуть запис, і клієнт лише марно згає час.
            Business.subscription_plan.in_(["trial", "active"]),
        )
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
    # Точка, від якої рахувати відстань. Прилітає з браузера, коли
    # людина дозволила геолокацію, або з центру обраного міста.
    near_lat: Optional[float] = Query(None, ge=-90, le=90),
    near_lng: Optional[float] = Query(None, ge=-180, le=180),
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

    # Сортування за відстанню, якщо відома точка людини.
    #
    # Формула гаверсинуса - точна для сфери. Спрощені варіанти
    # (різниця координат «навпростець») на широті України дають
    # помилку до 40%, бо градус довготи там коротший за градус
    # широти.
    if near_lat is not None and near_lng is not None:
        import math

        def distance_km(biz) -> float:
            if biz.latitude is None or biz.longitude is None:
                # Заклади без мітки йдуть у кінець, а не на початок:
                # показувати їх першими означало б обманювати - ми
                # не знаємо, де вони.
                return float("inf")

            lat1, lon1 = math.radians(near_lat), math.radians(near_lng)
            lat2 = math.radians(float(biz.latitude))
            lon2 = math.radians(float(biz.longitude))

            dlat, dlon = lat2 - lat1, lon2 - lon1
            a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
            return 6371.0 * 2 * math.asin(math.sqrt(a))

        for biz in available_businesses:
            biz.distance_km = round(distance_km(biz), 2) if distance_km(biz) != float("inf") else None

        available_businesses.sort(key=distance_km)

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

    # Графік роботи з business_hours - того самого джерела, що й CRM.
    #
    # Без цього сторінка салону визначала вихідні за застарілим полем
    # days_off: заклад міняв суботу в кабінеті, а клієнт бачив її
    # закритою, бо сторінка дивилась в інше місце.
    hours_res = await db.execute(
        select(BusinessHours)
        .where(BusinessHours.business_id == business.id)
        .order_by(BusinessHours.weekday)
    )
    response = BusinessOut.model_validate(business, from_attributes=True)
    response.working_hours = [
        WorkingDayOut(
            weekday=h.weekday,
            is_open=h.is_open,
            # У базі це тип time, а клієнту потрібен рядок «12:00»:
            # фронтенд порівнює години як текст, і об'єкт часу там
            # перетворився б на щось нечитабельне.
            open_time=h.open_time.strftime("%H:%M") if h.open_time else None,
            close_time=h.close_time.strftime("%H:%M") if h.close_time else None,
        )
        for h in hours_res.scalars().all()
    ]
    return response

# === Улюблені заклади клієнта ===

@router.get("/favorites/my")
async def list_my_favorites(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Збережені заклади поточного користувача.

    Раніше фронтенд писав у таблицю favorites НАПРЯМУ через Supabase,
    а в моделях її не існувало. Додавання мовчки не спрацьовувало,
    і профіль показував порожньо.
    """
    res = await db.execute(
        select(Business)
        .join(Favorite, Favorite.business_id == Business.id)
        .where(Favorite.user_id == str(current_user.id))
        .options(selectinload(Business.services))
        .order_by(Favorite.created_at.desc())
    )
    return [BusinessOut.model_validate(b, from_attributes=True) for b in res.scalars().all()]


@router.post("/{business_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def add_favorite(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Зберегти заклад. Повторне збереження - не помилка, а те саме."""
    res = await db.execute(select(Business).where(Business.id == business_id))
    if not res.scalars().first():
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    exists = await db.execute(
        select(Favorite).where(
            Favorite.user_id == str(current_user.id),
            Favorite.business_id == business_id,
        )
    )
    if exists.scalars().first():
        return

    db.add(Favorite(user_id=str(current_user.id), business_id=business_id))
    await db.commit()


@router.delete("/{business_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Прибрати заклад зі збережених."""
    await db.execute(
        delete(Favorite).where(
            Favorite.user_id == str(current_user.id),
            Favorite.business_id == business_id,
        )
    )
    await db.commit()
