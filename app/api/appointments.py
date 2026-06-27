from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from app.api.deps import get_db
from app.models.base import Appointment, Business, Service, \
    User  # Переконайся, що модель в base.py називається Appointment
from app.schemas.appointment import AppointmentCreate, AppointmentResponse

router = APIRouter(tags=["Appointments"])


@router.post("", response_model=AppointmentResponse)
async def create_appointment(appointment_in: AppointmentCreate, db: AsyncSession = Depends(get_db)):
    biz = await db.execute(select(Business).where(Business.id == appointment_in.business_id))
    if not biz.scalars().first():
        raise HTTPException(status_code=404, detail="Салон не знайдено")

    srv = await db.execute(select(Service).where(Service.id == appointment_in.service_id))
    service = srv.scalars().first()
    if not service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")

    end_time = appointment_in.start_time + timedelta(minutes=service.duration_minutes)

    new_appointment = Appointment(
        business_id=appointment_in.business_id,
        service_id=appointment_in.service_id,
        client_id=appointment_in.client_id,
        master_id=appointment_in.master_id,  # <-- Зберігаємо майстра
        start_time=appointment_in.start_time,
        end_time=end_time,
        status="confirmed"
    )
    db.add(new_appointment)
    await db.commit()
    await db.refresh(new_appointment)
    return new_appointment


# НОВИЙ РОУТ: Отримання зайнятих записів, щоб фронтенд бачив, хто зайнятий
@router.get("/booked", response_model=List[AppointmentResponse])
async def get_booked_appointments(business_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Appointment).where(Appointment.business_id == business_id))
    return result.scalars().all()