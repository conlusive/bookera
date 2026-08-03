from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import date, datetime, time, timedelta
from typing import Optional

from app.api.deps import get_db
from app.models.user import Business, Appointment

# 🔥 ОСЬ ЦЕЙ РЯДОК БУВ ВТРАЧЕНИЙ. Він створює router!
router = APIRouter()

@router.get("/search-available")
async def search_available_businesses(
    city: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    target_date: Optional[date] = Query(None),
    time_period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    # 1. Базовий пошук салонів (по місту та категорії)
    query = select(Business)
    if city:
        # Використовуємо address, бо в нашій моделі Business немає окремого поля city
        query = query.where(Business.address.ilike(f"%{city}%"))
    if category and category != "all":
        query = query.where(Business.category.ilike(f"%{category}%"))

    result = await db.execute(query)
    businesses = result.scalars().all()

    # Якщо дату не передали — просто повертаємо знайдені салони
    if not target_date:
        return businesses

    period_start = time(0, 0)
    period_end = time(23, 59)
    if time_period == "Ранок":
        period_start, period_end = time(8, 0), time(12, 0)
    elif time_period == "Обід":
        period_start, period_end = time(12, 0), time(16, 0)
    elif time_period == "Вечір":
        period_start, period_end = time(16, 0), time(22, 0)

    available_businesses = []

    # 3. Перевіряємо КОЖНИЙ салон
    for biz in businesses:
        start_datetime = datetime.combine(target_date, period_start)
        end_datetime = datetime.combine(target_date, period_end)

        # Шукаємо всі зайняті слоти в цей період
        bookings_query = select(Appointment).where(
            Appointment.business_id == biz.id,
            Appointment.status.in_(['confirmed', 'locked']),  # У тебе статус locked
            Appointment.start_time < end_datetime,
            Appointment.end_time > start_datetime
        )
        bookings_result = await db.execute(bookings_query)
        bookings = bookings_result.scalars().all()

        # Для MVP: припускаємо, що в салоні є хоча б 2 майстри, якщо таблиці Staff немає.
        # Або рахуємо унікальних майстрів, які вже мають записи.
        assumed_masters_count = 2
        max_slots_per_master = 4

        if len(bookings) < (assumed_masters_count * max_slots_per_master):
            available_businesses.append(biz)

    return available_businesses