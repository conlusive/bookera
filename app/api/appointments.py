from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, delete, update
from datetime import datetime, timedelta, timezone

from app.api.deps import get_db
from app.models.user import Appointment, Business, Service
from app.schemas.appointment import AppointmentCreate, AppointmentResponse, LockSlotRequest

router = APIRouter(tags=["Appointments"])


def get_utc_now():
    # Завжди використовуємо UTC для бази даних
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.post("/lock")
async def lock_time_slot(request: LockSlotRequest, db: AsyncSession = Depends(get_db)):
    # 1. Знаходимо послугу і рахуємо час
    srv = await db.execute(select(Service).where(Service.id == request.service_id))
    service = srv.scalars().first()
    if not service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")

    requested_end_time = request.start_time + timedelta(minutes=service.duration_minutes)
    now = get_utc_now()

    # 2. ПЕРЕВІРКА НАКЛАДОК (OVERLAP)
    # Шукаємо записи для цього майстра, де час перетинається з нашим
    # і статус "підтверджено" АБО (статус "заблоковано" і час дії лока ще не вийшов)
    overlap_query = select(Appointment).where(
        Appointment.master_id == request.master_id,
        Appointment.start_time < requested_end_time,
        Appointment.end_time > request.start_time,
        or_(
            Appointment.status == "confirmed",
            and_(Appointment.status == "locked", Appointment.expires_at > now)
        )
    )

    existing = await db.execute(overlap_query)
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Цей час щойно зайняли. Оберіть інший."
        )

    # 3. Видаляємо старі локи ЦЬОГО користувача, щоб він не наплодив їх по всьому календарю
    await db.execute(
        delete(Appointment).where(
            Appointment.client_id == request.client_id,
            Appointment.status == "locked"
        )
    )

    # 4. Створюємо новий лок на 10 хвилин
    new_lock = Appointment(
        business_id=request.business_id,
        service_id=request.service_id,
        client_id=request.client_id,
        master_id=request.master_id,
        start_time=request.start_time,
        end_time=requested_end_time,
        status="locked",
        expires_at=now + timedelta(minutes=10)
    )
    db.add(new_lock)
    await db.commit()

    return {"status": "success", "message": "Заблоковано на 10 хвилин"}


@router.post("/unlock")
async def unlock_time_slot(request: LockSlotRequest, db: AsyncSession = Depends(get_db)):
    # Миттєве видалення лока, якщо клієнт закрив модалку
    await db.execute(
        delete(Appointment).where(
            Appointment.client_id == request.client_id,
            Appointment.status == "locked"
        )
    )
    await db.commit()
    return {"status": "success"}


@router.post("", response_model=AppointmentResponse)
async def create_appointment(appointment_in: AppointmentCreate, db: AsyncSession = Depends(get_db)):
    # Перетворюємо "лок" на справжнє бронювання

    # Шукаємо активний лок цього клієнта на цей час
    lock_query = select(Appointment).where(
        Appointment.client_id == appointment_in.client_id,
        Appointment.master_id == appointment_in.master_id,
        Appointment.start_time == appointment_in.start_time,
        Appointment.status == "locked"
    )
    result = await db.execute(lock_query)
    appointment = result.scalars().first()

    if not appointment:
        # Якщо лока немає (згорів час, або юзер хакер), робимо ті ж перевірки, що і в /lock
        # (Тут можна додати логіку прямого бронювання, але для надійності краще відхилити)
        raise HTTPException(status_code=400, detail="Час бронювання минув або його зайнято. Спробуйте ще раз.")

    # Оновлюємо запис в БД: робимо його підтвердженим і прибираємо expires_at
    appointment.status = "confirmed"
    appointment.expires_at = None
    appointment.source = appointment_in.source

    await db.commit()
    await db.refresh(appointment)

    return appointment


@router.get("/booked", response_model=List[AppointmentResponse])
async def get_booked_appointments(business_id: int, db: AsyncSession = Depends(get_db)):
    now = get_utc_now()
    # Повертаємо на фронтенд тільки підтверджені записи, або ті, що зараз заблоковані і ще не протухли
    query = select(Appointment).where(
        Appointment.business_id == business_id,
        or_(
            Appointment.status == "confirmed",
            and_(Appointment.status == "locked", Appointment.expires_at > now)
        )
    )
    result = await db.execute(query)
    return result.scalars().all()