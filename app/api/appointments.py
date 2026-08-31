from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
import os
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.appointment import AppointmentStatusUpdate

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, get_current_user, require_business_access
from app.core.rate_limit import rate_limit
from app.models import Business, User, RoleEnum, Appointment, Service, BookingSourceEnum, BusinessHours, GiftCertificate, Client
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentResponse,
    AvailableSlotsResponse,
    LockSlotRequest,
    ManageBookingRequest,
    ManualAppointmentCreate,
    SlotStatusItem,
)
from app.core.email import send_booking_confirmation_email
from app.services.monetization import charge_commission_if_applicable, award_points_for_new_client

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

router = APIRouter(prefix="/appointments", tags=["Appointments"])

LOCK_TIMEOUT_MINUTES = 10


from app.core.time_utils import utc_now as get_utc_now


def normalize_master_id(raw) -> Optional[str]:
    """
    Фронтенд надсилає '0' як позначку 'майстра не обрано' - без нормалізації
    це буквально записується в БД і падає на зовнішньому ключі (master_id
    посилається на users.id, а користувача з id='0' не існує). Єдине місце
    цієї логіки замість трьох різних перевірок в різних ендпоінтах.
    """
    if raw is None:
        return None
    raw_str = str(raw)
    if raw_str in ("0", "", "null", "None"):
        return None
    return raw_str


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


# === 1. АЛГОРИТМ РОЗРАХУНКУ ВІЛЬНИХ СЛОТІВ ===

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

    # 1.1 Отримуємо заклад та послугу
    biz_res = await db.execute(select(Business).where(Business.id == business_id))
    business = biz_res.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    srv_res = await db.execute(select(Service).where(Service.id == service_id, Service.business_id == business_id))
    service = srv_res.scalars().first()
    if not service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")

    # 1.2 Графік роботи цього дня тижня (з нової таблиці business_hours,
    # замість колишнього JSON-поля days_off). weekday: 0=понеділок...6=неділя (ISO)
    iso_weekday = target_date.weekday()  # уже 0=понеділок в Python - без хитрого JS-зсуву
    hours_res = await db.execute(
        select(BusinessHours).where(
            BusinessHours.business_id == business_id,
            BusinessHours.weekday == iso_weekday,
        )
    )
    day_hours = hours_res.scalars().first()

    if day_hours is not None and not day_hours.is_open:
        return AvailableSlotsResponse(
            date=target_date,
            service_id=service.id,
            duration_minutes=service.duration_minutes,
            slots=[],
        )

    # 1.3 Межі робочого дня (дефолт 09:00-20:00, якщо графік ще не заповнений)
    open_mins = parse_hhmm_to_minutes(day_hours.open_time if day_hours else "09:00")
    close_mins = parse_hhmm_to_minutes(day_hours.close_time if day_hours else "20:00")
    duration = service.duration_minutes

    # 1.4 Майстри закладу
    masters_query = select(User).where(
        User.business_id == business_id,
        or_(User.role == RoleEnum.MASTER, User.role == RoleEnum.VENDOR)
    )
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

    # 1.6 Розрахунок кожного слота
    while current_mins + duration <= close_mins:
        slot_start_dt = datetime.combine(target_date, time(current_mins // 60, current_mins % 60))
        slot_end_dt = slot_start_dt + timedelta(minutes=duration)
        slot_str = format_minutes_to_hhmm(current_mins)

        # Пропускаємо години, що вже минули сьогодні
        if target_date == now.date() and slot_start_dt < now:
            current_mins += step_minutes
            continue

        if service.is_group:
            active_participants = sum(
                1 for b in existing_bookings
                if b.service_id == service.id and b.start_time < slot_end_dt and b.end_time > slot_start_dt
            )
            if active_participants >= (service.max_participants or 1):
                status_str = "booked"
            else:
                status_str = "available"
            free_masters_count = max(0, (service.max_participants or 1) - active_participants)
        else:
            if not active_masters:
                # Якщо майстрів окремо не додано, перевіряємо зайнятість слотів самого закладу
                conflict = next(
                    (b for b in existing_bookings if b.start_time < slot_end_dt and b.end_time > slot_start_dt),
                    None
                )
                if not conflict:
                    status_str = "available"
                    free_masters_count = 1
                elif conflict.status == "blocked" and conflict.expires_at and conflict.expires_at > now:
                    status_str = "locked"
                    free_masters_count = 0
                else:
                    status_str = "booked"
                    free_masters_count = 0
            else:
                free_masters = 0
                locked_by_others = 0

                for m in active_masters:
                    conflict = next(
                        (b for b in existing_bookings if str(b.master_id) == str(m.id) and b.start_time < slot_end_dt and b.end_time > slot_start_dt),
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
async def lock_time_slot(
    request: LockSlotRequest,
    db: AsyncSession = Depends(get_db),
    _rl=Depends(rate_limit("lock", max_requests=20, window_seconds=60)),
):
    now = get_utc_now()

    srv_result = await db.execute(
        select(Service).where(Service.id == request.service_id, Service.business_id == request.business_id)
    )
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
                select(User).where(
                    User.business_id == request.business_id,
                    or_(User.role == RoleEnum.MASTER, User.role == RoleEnum.VENDOR)
                )
            )
            active_masters = masters_result.scalars().all()
            assigned_master_id = None

            for master in active_masters:
                overlap = await db.execute(
                    select(Appointment).where(
                        Appointment.business_id == request.business_id,
                        Appointment.master_id == str(master.id),
                        Appointment.start_time < requested_end_time,
                        Appointment.end_time > request.start_time,
                        or_(
                            Appointment.status == "confirmed",
                            and_(Appointment.status == "blocked", Appointment.expires_at > now),
                        ),
                    )
                )
                if not overlap.scalars().first():
                    assigned_master_id = str(master.id)
                    break
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

    # Очищуємо старі незавершені блоки цієї ж браузерної сесії
    if request.session_token:
        await db.execute(
            delete(Appointment).where(
                Appointment.session_token == request.session_token,
                Appointment.status == "blocked",
            )
        )

    new_lock = Appointment(
        business_id=request.business_id,
        service_id=request.service_id,
        client_id=request.client_id,
        session_token=request.session_token,
        master_id=str(assigned_master_id) if assigned_master_id else None,
        start_time=request.start_time,
        end_time=requested_end_time,
        status="blocked",
        source=str(getattr(request, "source", BookingSourceEnum.DIRECT)),
        price=service.price,
        created_at=now,
        expires_at=now + timedelta(minutes=LOCK_TIMEOUT_MINUTES),
    )
    db.add(new_lock)
    try:
        await db.commit()
    except IntegrityError:
        # Спрацював exclusion constraint на рівні БД (no_overlapping_bookings) -
        # хтось інший щойно зайняв цей самий слот між нашою перевіркою і вставкою.
        # Це і є справжній, надійний захист від подвійного бронювання: перевірка
        # в Python вище - лише оптимізація, щоб не чекати зайвий round-trip у типовому випадку.
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Цей час щойно зайняли.")
    await db.refresh(new_lock)

    return {"status": "success", "booking_id": new_lock.id, "message": "Заблоковано на 10 хвилин"}


@router.post("/unlock")
async def unlock_time_slot(request: LockSlotRequest, db: AsyncSession = Depends(get_db)):
    if request.session_token:
        await db.execute(
            delete(Appointment).where(
                Appointment.session_token == request.session_token,
                Appointment.status == "blocked",
            )
        )
        await db.commit()
    return {"status": "success"}


# === 3. ПІДТВЕРДЖЕННЯ ТА EMAIL-СПОВІЩЕННЯ ===

@router.post("", response_model=AppointmentResponse)
async def create_appointment(
    appointment_in: AppointmentCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    now = get_utc_now()

    lock_query = select(Appointment).where(
        Appointment.service_id == appointment_in.service_id,
        Appointment.start_time == appointment_in.start_time,
        Appointment.status == "blocked",
        Appointment.expires_at > now,
    )
    if appointment_in.master_id and appointment_in.master_id not in ("0", "", "null", "None"):
        lock_query = lock_query.where(Appointment.master_id == normalize_master_id(appointment_in.master_id))
    if appointment_in.session_token:
        lock_query = lock_query.where(Appointment.session_token == appointment_in.session_token)

    result = await db.execute(lock_query)
    appointment = result.scalars().first()

    if not appointment:
        # Прибираємо прострочені локи цього закладу перед прямою вставкою -
        # той самий цикл очищення, що й у /lock, потрібен і тут, інакше
        # "мертвий" протермінований блок може безпідставно заважати новому запису.
        now_cleanup = get_utc_now()
        await db.execute(
            delete(Appointment).where(
                Appointment.business_id == appointment_in.business_id,
                Appointment.status == "blocked",
                Appointment.expires_at < now_cleanup,
            )
        )

    biz_res = await db.execute(select(Business).where(Business.id == appointment_in.business_id))
    business = biz_res.scalars().first()

    # Джерело визначає СЕРВЕР, звіряючи токен з тим, що збережений у бізнесу -
    # клієнт більше не може просто заявити "я прийшов напряму" і уникнути комісії.
    resolved_source = (
        "direct"
        if business and appointment_in.direct_link_token and appointment_in.direct_link_token == business.direct_link_token
        else "marketplace"
    )

    srv_res = await db.execute(
        select(Service).where(Service.id == appointment_in.service_id, Service.business_id == appointment_in.business_id)
    )
    service = srv_res.scalars().first()

    # Застосування подарункового сертифіката - зменшує ціну, не робить
    # бронювання безкоштовним понад залишок сертифіката.
    applied_certificate = None
    final_price = service.price if service else Decimal("0")
    if appointment_in.gift_certificate_code and service:
        cert_res = await db.execute(
            select(GiftCertificate).where(
                GiftCertificate.code == appointment_in.gift_certificate_code.upper(),
                GiftCertificate.business_id == appointment_in.business_id,
                GiftCertificate.status == "active",
            )
        )
        applied_certificate = cert_res.scalars().first()
        if applied_certificate and (not applied_certificate.expires_at or applied_certificate.expires_at > now):
            discount = min(applied_certificate.remaining_amount, final_price)
            final_price = final_price - discount
            applied_certificate.remaining_amount -= discount
            if applied_certificate.remaining_amount <= 0:
                applied_certificate.status = "redeemed"
        else:
            applied_certificate = None  # невалідний/протермінований - ігноруємо мовчки, ціна лишається повною

    # Створюємо/знаходимо CRM-контакт для цього бізнесу за телефоном.
    # Раніше це робив фронтенд, пишучи НАПРЯМУ в таблицю клієнтів чужого
    # бізнесу без авторизації - тепер це робить сервер, як і має бути.
    resolved_client_id = appointment_in.client_id
    if resolved_client_id is None and appointment_in.client_phone and business:
        existing_client = await db.execute(
            select(Client).where(
                Client.business_id == appointment_in.business_id,
                Client.phone == appointment_in.client_phone,
            )
        )
        crm_client = existing_client.scalars().first()
        if not crm_client:
            crm_client = Client(
                business_id=appointment_in.business_id,
                name=appointment_in.client_name or appointment_in.client_phone,
                phone=appointment_in.client_phone,
                email=appointment_in.client_email,
                tags=["Онлайн-запис"],
            )
            db.add(crm_client)
            await db.flush()
            await award_points_for_new_client(db, business, appointment_in.client_phone, crm_client.id)
        resolved_client_id = crm_client.id

    if not appointment:
        # Створюємо прямий запис, якщо блоку не було
        requested_end_time = appointment_in.start_time + timedelta(
            minutes=(service.duration_minutes if service else 60)
        )
        appointment = Appointment(
            business_id=appointment_in.business_id,
            service_id=appointment_in.service_id,
            master_id=normalize_master_id(appointment_in.master_id),
            client_id=resolved_client_id,
            session_token=appointment_in.session_token,
            start_time=appointment_in.start_time,
            end_time=requested_end_time,
            status="confirmed",
            price=final_price,
            client_name=appointment_in.client_name,
            client_phone=appointment_in.client_phone,
            client_email=appointment_in.client_email,
            source=resolved_source,
            manage_token=secrets.token_urlsafe(24),
            created_at=now,
        )
        db.add(appointment)
    else:
        appointment.status = "confirmed"
        appointment.expires_at = None
        appointment.client_id = resolved_client_id
        appointment.price = final_price
        appointment.client_name = appointment_in.client_name
        appointment.client_phone = appointment_in.client_phone
        appointment.client_email = appointment_in.client_email
        appointment.manage_token = secrets.token_urlsafe(24)
        # source визначає сервер (resolved_source), а не клієнтське поле -
        # раніше тут лишався appointment_in.source, якого в схемі вже немає.
        appointment.source = resolved_source

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Цей час щойно зайняли.")
    await db.refresh(appointment)

    # Фонова відправка листа клієнту через SMTP
    if appointment_in.client_email and business and service:
        background_tasks.add_task(
            send_booking_confirmation_email,
            to_email=appointment_in.client_email,
            client_name=appointment_in.client_name or "Клієнт",
            business_name=business.name,
            service_name=service.name,
            booking_date=appointment.start_time.strftime("%d.%m.%Y"),
            booking_time=appointment.start_time.strftime("%H:%M"),
            price=float(service.price or 0),
            address=f"{business.city}, {business.address or ''}",
            manage_url=f"{FRONTEND_URL}/my-booking/{appointment.id}?token={appointment.manage_token}",
        )

    return appointment


@router.get("/{appointment_id}/manage", response_model=AppointmentResponse)
async def get_appointment_for_client(
    appointment_id: int,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Дозволяє клієнту переглянути СВОЄ бронювання за токеном з листа -
    без потреби реєструватись/логінитись (гостьове бронювання).
    """
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalars().first()
    if not appointment or not appointment.manage_token or appointment.manage_token != token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Бронювання не знайдено")
    return appointment


@router.post("/{appointment_id}/cancel", response_model=AppointmentResponse)
async def cancel_appointment_by_client(
    appointment_id: int,
    payload: ManageBookingRequest,
    db: AsyncSession = Depends(get_db),
):
    """Клієнт скасовує власне бронювання за токеном - без авторизації бізнесу."""
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalars().first()
    if not appointment or not appointment.manage_token or appointment.manage_token != payload.token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Бронювання не знайдено")

    if appointment.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Це бронювання вже скасоване")
    if appointment.status == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Візит вже відбувся, скасування неможливе")
    if appointment.start_time <= get_utc_now():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Час візиту вже настав")

    appointment.status = "cancelled"
    await db.commit()
    await db.refresh(appointment)
    return appointment


@router.get("/booked", response_model=List[AppointmentResponse])
async def get_booked_appointments(
    business_id: int,
    master_id: Optional[str] = Query(None, description="Фільтр записів за майстром"),
    db: AsyncSession = Depends(get_db),
    _current_user: CurrentUser = Depends(require_business_access),
):
    # ВАЖЛИВО: цей ендпоінт віддає ім'я, телефон і email клієнтів.
    # Раніше був доступний без жодної авторизації - будь-хто, хто знав
    # business_id, міг вивантажити всі контакти клієнтів закладу.
    now = get_utc_now()
    query = select(Appointment).where(
        Appointment.business_id == business_id,
        or_(
            Appointment.status == "confirmed",
            and_(Appointment.status == "blocked", Appointment.expires_at > now),
        ),
    )

    if master_id and master_id not in ("all", "0", "null", ""):
        query = query.where(Appointment.master_id == str(master_id))

    result = await db.execute(query)
    return result.scalars().all()

@router.patch("/{appointment_id}/status", response_model=AppointmentResponse)
async def update_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    stmt = select(Appointment).where(Appointment.id == appointment_id)
    result = await db.execute(stmt)
    appointment = result.scalars().first()

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Візит не знайдено"
        )

    # business_id відомий лише ПІСЛЯ того, як знайшли запис - тому перевірка
    # доступу тут ручна (assert_business_access), а не через FastAPI-залежність.
    await assert_business_access(db, current_user, appointment.business_id)

    appointment.status = payload.status

    if payload.status == "completed":
        biz_res = await db.execute(select(Business).where(Business.id == appointment.business_id))
        business = biz_res.scalars().first()
        if business:
            await charge_commission_if_applicable(db, appointment, business)

    await db.commit()
    await db.refresh(appointment)
    return appointment