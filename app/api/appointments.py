from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from datetime import timedelta
from app.api.deps import get_db
from app.models.base import Appointment, Service
from app.schemas.appointment import AppointmentCreate, AppointmentResponse
from typing import List

# Створюємо роутер для записів
router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.post("/", response_model=AppointmentResponse)
async def create_appointment(app_in: AppointmentCreate, db: AsyncSession = Depends(get_db)):
    # ВІДРІЗАЄМО ЧАСОВИЙ ПОЯС: робимо час "наївним", щоб БД його прийняла
    naive_start = app_in.start_time.replace(tzinfo=None)

    # 1. Отримуємо послугу з БД, щоб дізнатися її тривалість
    service_result = await db.execute(select(Service).where(Service.id == app_in.service_id))
    service = service_result.scalars().first()
    if not service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")

    # 2. Вираховуємо точний час закінчення процедури (використовуємо naive_start)
    end_time = naive_start + timedelta(minutes=service.duration_minutes)

    # 3. Перевірка на подвійне бронювання
    overlap_query = select(Appointment).where(
        and_(
            Appointment.business_id == app_in.business_id,
            Appointment.status != "cancelled",
            or_(
                # Логіка: (Новий старт < Старий кінець) І (Новий кінець > Старий старт)
                and_(naive_start < Appointment.end_time, end_time > Appointment.start_time)
            )
        )
    )
    overlap_result = await db.execute(overlap_query)
    if overlap_result.scalars().first():
        raise HTTPException(status_code=400, detail="На жаль, цей час вже зайнятий іншим клієнтом")

    # 4. Якщо час вільний — створюємо запис (використовуємо naive_start)
    new_appointment = Appointment(
        business_id=app_in.business_id,
        client_id=app_in.client_id,
        service_id=app_in.service_id,
        start_time=naive_start,
        end_time=end_time,
        status="confirmed"
    )

    db.add(new_appointment)
    await db.commit()
    await db.refresh(new_appointment)

    return new_appointment

@router.get("/business/{business_id}", response_model=List[AppointmentResponse])
async def get_booked_time_slots(business_id: int, db: AsyncSession = Depends(get_db)):
    # Повертаємо всі активні (не скасовані) записи для конкретного салону
    query = select(Appointment).where(
        and_(
            Appointment.business_id == business_id,
            Appointment.status != "cancelled"
        )
    )
    result = await db.execute(query)
    appointments = result.scalars().all()
    return appointments