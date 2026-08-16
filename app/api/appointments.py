from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, delete, or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.user import Appointment, BookingSourceEnum, Business, RoleEnum, Service, User
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentResponse,
    AvailableSlotsResponse,
    LockSlotRequest,
    SlotStatusItem,
)

router = APIRouter(prefix="/appointments", tags=["Appointments"])

LOCK_TIMEOUT_MINUTES = 10


def get_utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_hhmm_to_minutes(t_val) -> int:
    if isinstance(t_val, str):
        parts = t_val.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    elif isinstance(t_val, time):
        return t_val.hour * 60 + t_val.minute
    return 0


def format_minutes_to_hhmm(mins: int) -> str:
    h = (mins // 60) % 24
    m = mins % 60
    return f"{h:02d}:{m:02d}"


# === 1. АЛГОРИТМ РОЗРАХУНКУ ВІЛЬНИХ СЛОТІВ (SLOT ENGINE) ===

@router.get("/available-slots", response_model=AvailableSlotsResponse)
async def get_available_slots(
    business_id: int = Query(...),
    service_id: int = Query(...),
    target_date: date = Query(...),
    master_id: Optional[str] = Query("0"),
    step_minutes: int = Query(15, ge=5, le=60),
    db: AsyncSession = Depends(get_db),
):
    now = get_utc_now()

    # 1.1 Отримуємо салон та послугу
    biz_res = await db.execute(select(Business).where(Business.id == business_id))
    business = biz_res.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    srv_res = await db.execute(select(Service).where(Service.id == service_id, Service.business_id == business_id))
    service = srv_res.scalars().first()
    if not service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")

    # 1.2 Перевірка вихідного дня закладу
    weekday_idx = (target_date.weekday() + 1) % 7
    days_off = getattr(business, "days_off", []) or []
    if weekday_idx in days_off:
        return AvailableSlotsResponse(
            date=target_date,
            service_id=service.id,
            duration_minutes=service.duration_minutes,
            slots=[],
        )

    # 1.3 Графік роботи
    open_mins = parse_hhmm_to_minutes(getattr(business, "open_time", "09:00") or "09:00")
    close_mins = parse_hhmm_to_minutes(getattr(business, "close_time", "20:00") or "20:00")
    duration = service.duration_minutes

    # 1.4 Майстри закладу
    masters_query = select(User).where(User.business_id == business_id, User.role == RoleEnum.master)
    if master_id not in ("0", "", None, "null"):
        masters_query = masters_query.where(User.id == master_id)

    masters_res = await db.execute(masters_query)
    active_masters = masters_res.scalars().all()

    # 1.5 Отримуємо всі записи на цей день
    day_start = datetime.combine(target_date, time(0, 0, 0))
    day_end = datetime.combine(target_date, time(23, 59, 59))

    appointments_query = select(Appointment).where(
        Appointment.business_id == business_id,
        Appointment.start_time >= day_start,
        Appointment.start_time <= day_end,
        or_(
            Appointment.status == "confirmed",
            and_(Appointment.status == "blocked", Appointment.expires_at > now),
        ),
    )
    app_res = await db.execute(appointments_query)
    existing_bookings = app_res.scalars().all()

    slots_result: List[SlotStatusItem] = []
    current_mins = open_mins

    # 1.6 Генерація та перевірка кожного часового інтервалу
    while current_mins + duration <= close_mins:
        slot_start_dt = datetime.combine(target_date, time(current_mins // 60, current_mins % 60))
        slot_end_dt = slot_start_dt + timedelta(minutes=duration)
        slot_str = format_minutes_to_hhmm(current_mins)

        # Пропускаємо години, що вже минули сьогодні
        if target_date == now.date() and slot_start_dt < now:
            current_mins += step_minutes
            continue

        if service.is_group:
            # Логіка для групових занять
            active_participants = sum(
                1 for b in existing_bookings
                if b.service_id == service.id and b.start_time < slot_end_dt and b.end_time > slot_start_dt
            )
            if active_participants >= service.max_participants:
                status_str = "booked"
            else:
                status_str = "available"
            free_masters_count = max(0, service.max_participants - active_participants)
        else:
            # Індивідуальні послуги
            if not active_masters:
                free_masters_count = 0
                status_str = "booked"
            else:
                free_masters = 0
                locked_by_others = 0

                for m in active_masters:
                    conflict = next(
                        (b for b in existing_bookings if b.master_id == m.id and b.start_time < slot_end_dt and b.end_time > slot_start_dt),
                        None
                    )
                    if not conflict:
                        free_masters += 1
                    elif conflict.status == "blocked" and conflict.expires_at and conflict.expires_at > now:
                        locked_by_others += 1

                if free_masters > 0:
                    status_str = "available"
                elif locked_by_others > 0:
                    status_str = "locked"
                else:
                    status_str = "booked"

                free_masters_count = free_masters

        slots_result.append(
            SlotStatusItem(
                time=slot_str,
                status=status_str,
                available_masters_count=free_masters_count,
            )
        )
        current_mins += step_minutes

    return AvailableSlotsResponse(
        date=target_date,
        service_id=service.id,
        duration_minutes=service.duration_minutes,
        slots=slots_result,
    )


# === 2. БЛОКУВАННЯ ТА РОЗБЛОКУВАННЯ ===

@router.post("/lock")
async def lock_time_slot(request: LockSlotRequest, db: AsyncSession = Depends(get_db)):
    now = get_utc_now()

    srv_result = await db.execute(select(Service).where(Service.id == request.service_id))
    service = srv_result.scalars().first()
    if not service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")

    requested_end_time = request.start_time + timedelta(minutes=service.duration_minutes)

    # Очищення прострочених локів
    await db.execute(
        delete(Appointment).where(
            Appointment.business_id == request.business_id,
            Appointment.status == "blocked",
            Appointment.expires_at < now,
        )
    )

    master_id = str(getattr(request, "master_id", "0"))
    assigned_master_id = master_id

    if not service.is_group:
        if master_id in ("0", "", "None", "null"):
            masters_result = await db.execute(
                select(User).where(User.business_id == request.business_id, User.role == RoleEnum.master)
            )
            active_masters = masters_result.scalars().all()
            assigned_master_id = None

            for master in active_masters:
                overlap = await db.execute(
                    select(Appointment).where(
                        Appointment.business_id == request.business_id,
                        Appointment.master_id == master.id,
                        Appointment.start_time < requested_end_time,
                        Appointment.end_time > request.start_time,
                        or_(
                            Appointment.status == "confirmed",
                            and_(Appointment.status == "blocked", Appointment.expires_at > now),
                        ),
                    )
                )
                if not overlap.scalars().first():
                    assigned_master_id = master.id
                    break

            if not assigned_master_id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="На цей час немає вільних майстрів.")
        else:
            overlap = await db.execute(
                select(Appointment).where(
                    Appointment.business_id == request.business_id,
                    Appointment.master_id == master_id,
                    Appointment.start_time < requested_end_time,
                    Appointment.end_time > request.start_time,
                    or_(
                        Appointment.status == "confirmed",
                        and_(Appointment.status == "blocked", Appointment.expires_at > now),
                    ),
                )
            )
            if overlap.scalars().first():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Цей час щойно зайняли.")

    # Видаляємо попередні активні локи цього клієнта
    if request.client_id:
        await db.execute(
            delete(Appointment).where(
                Appointment.client_id == str(request.client_id),
                Appointment.status == "blocked",
            )
        )

    new_lock = Appointment(
        business_id=request.business_id,
        service_id=request.service_id,
        client_id=str(request.client_id) if request.client_id else None,
        master_id=str(assigned_master_id) if assigned_master_id else None,
        start_time=request.start_time,
        end_time=requested_end_time,
        status="blocked",
        source=getattr(request, "source", BookingSourceEnum.DIRECT),
        created_at=now,
        expires_at=now + timedelta(minutes=LOCK_TIMEOUT_MINUTES),
    )
    db.add(new_lock)
    await db.commit()
    await db.refresh(new_lock)

    return {"status": "success", "booking_id": new_lock.id, "message": "Заблоковано на 10 хвилин"}


@router.post("/unlock")
async def unlock_time_slot(request: LockSlotRequest, db: AsyncSession = Depends(get_db)):
    if request.client_id:
        await db.execute(
            delete(Appointment).where(
                Appointment.client_id == str(request.client_id),
                Appointment.status == "blocked",
            )
        )
        await db.commit()
    return {"status": "success"}


# === 3. ПІДТВЕРДЖЕННЯ ТА ОТРИМАННЯ РОЗКЛАДУ ===

@router.post("", response_model=AppointmentResponse)
async def create_appointment(appointment_in: AppointmentCreate, db: AsyncSession = Depends(get_db)):
    now = get_utc_now()

    lock_query = select(Appointment).where(
        Appointment.service_id == appointment_in.service_id,
        Appointment.master_id == str(appointment_in.master_id),
        Appointment.start_time == appointment_in.start_time,
        Appointment.status == "blocked",
        Appointment.expires_at > now,
    )
    if appointment_in.client_id:
        lock_query = lock_query.where(Appointment.client_id == str(appointment_in.client_id))

    result = await db.execute(lock_query)
    appointment = result.scalars().first()

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Час бронювання вичерпано або його зайнято. Оберіть інший час.",
        )

    appointment.status = "confirmed"
    appointment.expires_at = None
    if appointment_in.source:
        appointment.source = appointment_in.source

    await db.commit()
    await db.refresh(appointment)
    return appointment


@router.get("/booked", response_model=List[AppointmentResponse])
async def get_booked_appointments(
        business_id: int,
        master_id: Optional[str] = Query(None, description="Фільтр записів за конкретним майстром"),
        db: AsyncSession = Depends(get_db)
):
    now = get_utc_now()
    query = select(Appointment).where(
        Appointment.business_id == business_id,
        or_(
            Appointment.status == "confirmed",
            and_(Appointment.status == "blocked", Appointment.expires_at > now),
        ),
    )

    # 🟢 Якщо передано master_id, віддаємо лише записи конкретного фахівця
    if master_id and master_id not in ("all", "0", "null", ""):
        query = query.where(Appointment.master_id == str(master_id))

    result = await db.execute(query)
    return result.scalars().all()