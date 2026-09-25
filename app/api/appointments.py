from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
import os
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.appointment import AppointmentStatusUpdate, MyAppointmentResponse

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, get_current_user, require_business_access, is_limited_to_own_schedule
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
from app.core.email import send_booking_confirmation_email, send_new_booking_to_staff
from app.services.subscription import has_access
from app.services.monetization import charge_commission_if_applicable, award_points_for_new_client
from app.services.inventory import consume_materials_for_appointment, revert_materials_for_appointment

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

router = APIRouter(prefix="/appointments", tags=["Appointments"])

LOCK_TIMEOUT_MINUTES = 10


from app.core.time_utils import utc_now as get_utc_now, local_now, to_utc, to_local


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
    step_minutes: Optional[int] = Query(None, ge=5, le=60, description="Крок сітки; за замовчуванням - налаштування закладу"),
    duration_minutes: Optional[int] = Query(None, ge=5, le=480, description="Сумарна тривалість візиту з додатковими послугами"),
    db: AsyncSession = Depends(get_db),
):
    now = get_utc_now()

    # 1.1 Отримуємо заклад та послугу
    biz_res = await db.execute(select(Business).where(Business.id == business_id))
    business = biz_res.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    # Крок сітки бере заклад, а не клієнт.
    #
    # Раніше він приходив параметром із фронтенду і завжди дорівнював 15 -
    # тому налаштування «крок 30 хвилин» у CRM нічого не змінювало.
    # Для манікюру з візитами по 1.5 години сітка на 15 хвилин означала
    # вчетверо більше слотів, ніж має сенс показувати.
    #
    # Явний параметр лишається: він потрібен адміністративним екранам,
    # де іноді треба побачити дрібнішу сітку, ніж у публічному записі.
    if step_minutes is None:
        rules = business.booking_settings or {}
        raw_step = rules.get("time_step")
        step_minutes = int(raw_step) if isinstance(raw_step, (int, float)) and 5 <= raw_step <= 60 else 15

    # Поточний час У ПОЯСІ ЗАКЛАДУ: слоти живуть у локальному часі,
    # тому й порівнювати їх треба з локальним «зараз».
    local_time_now = local_now(business)

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
            server_time=local_time_now.strftime("%Y-%m-%d %H:%M"),
        )

    # 1.3 Межі робочого дня (дефолт 09:00-20:00, якщо графік ще не заповнений)
    open_mins = parse_hhmm_to_minutes(day_hours.open_time if day_hours else "09:00")
    close_mins = parse_hhmm_to_minutes(day_hours.close_time if day_hours else "20:00")
    # Тривалість візиту.
    #
    # Клієнт може передати сумарну - з додатковими послугами. Без цього
    # сітка рахувалась би за самою послугою: людина обрала стрижку
    # з бородою на 70 хвилин, а слот на 19:00 показувався вільним,
    # хоча заклад закривається о 20:00 і візит не вміщається.
    #
    # Верхня межа стоїть у Query (480 хв): без неї можна було б
    # передати будь-яке число й забити весь день одним запитом.
    duration = duration_minutes or service.duration_minutes

    # Буфер після візиту: прибрати, підготувати місце, помити руки.
    #
    # Додається до тривалості лише для РОЗРАХУНКУ зайнятості, а не до
    # самого запису: клієнт має бачити «45 хв», а не «55 хв» - буфер
    # це внутрішня справа закладу, не послуга.
    #
    # Саме через невраховані 10-15 хвилин майстри й спізнюються:
    # календар обіцяє час, якого фізично немає.
    rules_for_slots = business.booking_settings or {}
    raw_buffer = rules_for_slots.get("buffer_minutes")
    buffer_minutes = int(raw_buffer) if isinstance(raw_buffer, (int, float)) and 0 <= raw_buffer <= 60 else 0
    occupied_duration = duration + buffer_minutes

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
            and_(
                Appointment.status == "blocked",
                # Постійні блокування (обід, перерва) не мають expires_at,
                # і порівняння NULL > now завжди хибне - через це клієнт
                # міг записатись на час, який заклад заблокував.
                or_(Appointment.expires_at.is_(None), Appointment.expires_at > now),
            ),
        ),
    )
    app_res = await db.execute(appointments_query)
    existing_bookings = app_res.scalars().all()

    slots_result: List[SlotStatusItem] = []
    current_mins = open_mins

    # 1.6 Розрахунок кожного слота
    while current_mins + duration <= close_mins:
        slot_start_dt = datetime.combine(target_date, time(current_mins // 60, current_mins % 60))
        # Для перевірки зайнятості беремо час ІЗ буфером: наступний
        # клієнт не має потрапити впритул до попереднього.
        slot_end_dt = slot_start_dt + timedelta(minutes=occupied_duration)
        slot_str = format_minutes_to_hhmm(current_mins)

        # Пропускаємо години, що вже минули сьогодні
        # Минулі слоти не показуємо.
        #
        # Порівнюємо з ЛОКАЛЬНИМ часом закладу, а не з UTC. Раніше тут
        # стояв now (UTC), і о 12:00 за Києвом він давав 09:00 - слоти
        # з 10:00 виглядали майбутніми, хоча вже минули.
        #
        # Плюс невеликий запас: показувати слот, до якого лишилось
        # 5 хвилин, безглуздо - людина не встигне доїхати.
        if target_date == local_time_now.date() and slot_start_dt < local_time_now + timedelta(minutes=5):
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
        server_time=local_time_now.strftime('%Y-%m-%d %H:%M'),
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
                            and_(
                Appointment.status == "blocked",
                # Постійні блокування (обід, перерва) не мають expires_at,
                # і порівняння NULL > now завжди хибне - через це клієнт
                # міг записатись на час, який заклад заблокував.
                or_(Appointment.expires_at.is_(None), Appointment.expires_at > now),
            ),
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
                        and_(
                Appointment.status == "blocked",
                # Постійні блокування (обід, перерва) не мають expires_at,
                # і порівняння NULL > now завжди хибне - через це клієнт
                # міг записатись на час, який заклад заблокував.
                or_(Appointment.expires_at.is_(None), Appointment.expires_at > now),
            ),
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

    # === Правила онлайн-бронювання ===
    #
    # Заклад налаштовує їх у CRM, але досі вони НІЧОГО не робили:
    # зберігались у базі й ніде не читались. Тобто «зупинити прийом
    # записів» чи «не раніше ніж за 2 години» були декорацією -
    # клієнт міг записатись попри них.
    #
    # Перевіряємо ДО будь-яких змін у базі: відмовляти треба на вході,
    # а не після того, як слот уже зайнято.
    biz_res = await db.execute(select(Business).where(Business.id == appointment_in.business_id))
    business_for_rules = biz_res.scalars().first()
    if not business_for_rules:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заклад не знайдено")

    # Заклад без чинної підписки не приймає записів.
    #
    # Інакше виходить найгірше: клієнт записується, отримує лист із
    # підтвердженням, приходить - а заклад цього запису НЕ БАЧИВ,
    # бо кабінет для нього закритий. Краще чесно не прийняти запис,
    # ніж прийняти й загубити.
    #
    # Формулювання нейтральне: клієнту не повідомляємо, що в закладу
    # проблеми з оплатою сервісу - це не його справа.
    if not has_access(business_for_rules):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Онлайн-запис тимчасово недоступний. Зверніться до закладу.",
        )

    rules = business_for_rules.booking_settings or {}
    notify = business_for_rules.notification_settings or {}

    # Налаштування сповіщень досі зберігались і не читались: перемикачі
    # у CRM нічого не вимикали. Значення за замовчуванням - True, щоб
    # заклади, які їх не чіпали, поводились як раніше.
    auto_approve = notify.get("auto_approve", True) is not False
    notify_client = notify.get("notify_client_booking", True) is not False

    # Депозит. Налаштування зберігалось, але на запис не впливало -
    # заклад думав, що передоплата обовʼязкова, а вона ніде не виникала.
    #
    # Реальної оплати тут не проводимо (для цього потрібен платіжний
    # провайдер): фіксуємо СУМУ до сплати в самому записі. Заклад бачить
    # її в календарі й може взяти передоплату будь-яким своїм способом,
    # а коли підключиться WayForPay - сума вже буде порахована.
    payments = business_for_rules.payments_settings or {}
    deposit_due = None
    if payments.get("require_deposit") is True:
        amount = payments.get("deposit_amount")
        if isinstance(amount, (int, float)) and amount > 0:
            deposit_due = Decimal(str(amount))

    if rules.get("is_active") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Онлайн-запис у цьому закладі вимкнено",
        )

    if rules.get("is_paused_emergency") is True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Заклад тимчасово не приймає онлайн-записи",
        )

    # Закриті періоди: відпустка, санітарні дні, ремонт.
    #
    # Раніше закрити тиждень означало вимкнути кожен день у графіку
    # окремо, а потім не забути увімкнути назад - і половина закладів
    # забувала. Тут це один запис із датами.
    closed_periods = rules.get("closed_periods") or []
    booking_day = appointment_in.start_time.date()
    for period in closed_periods:
        try:
            start = date.fromisoformat(str(period.get("start")))
            end = date.fromisoformat(str(period.get("end")))
        except (TypeError, ValueError):
            continue
        if start <= booking_day <= end:
            reason = str(period.get("reason") or "").strip()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Заклад не працює в цей період{f': {reason}' if reason else ''}",
            )

    booking_start = appointment_in.start_time
    if booking_start.tzinfo is not None:
        booking_start = booking_start.replace(tzinfo=None)

    # === Чорний список і захист від неявок ===
    #
    # security_settings так само зберігались і не читались: позначка
    # клієнта як «у чорному списку» не заважала йому записатись знову.
    security = business_for_rules.security_settings or {}
    phone_digits = "".join(ch for ch in (appointment_in.client_phone or "") if ch.isdigit())

    if phone_digits:
        client_res = await db.execute(
            select(Client).where(
                Client.business_id == appointment_in.business_id,
                Client.phone.isnot(None),
            )
        )
        for existing in client_res.scalars().all():
            existing_digits = "".join(ch for ch in (existing.phone or "") if ch.isdigit())
            if not existing_digits or existing_digits[-9:] != phone_digits[-9:]:
                continue

            if existing.is_blacklisted:
                # Формулювання свідомо нейтральне: клієнту не повідомляємо,
                # що він у чорному списку - це розмова для закладу, а не
                # для автоматичного повідомлення на сайті.
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Онлайн-запис для цього номера недоступний. Зверніться до закладу.",
                )

            if security.get("block_no_shows") is True:
                no_shows = await db.execute(
                    select(func.count(Appointment.id)).where(
                        Appointment.business_id == appointment_in.business_id,
                        Appointment.client_phone.isnot(None),
                        Appointment.status == "no-show",
                        Appointment.client_phone.like(f"%{phone_digits[-9:]}"),
                    )
                )
                if (no_shows.scalar() or 0) >= 3:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Онлайн-запис для цього номера недоступний. Зверніться до закладу.",
                    )
            break

    min_hours = rules.get("min_advance_hours")
    if isinstance(min_hours, (int, float)) and min_hours > 0:
        earliest = now + timedelta(hours=float(min_hours))
        if booking_start < earliest:
            hours_word = int(min_hours)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Записатись можна щонайменше за {hours_word} год до візиту",
            )

    max_days = rules.get("max_advance_days")
    if isinstance(max_days, (int, float)) and max_days > 0:
        latest = now + timedelta(days=float(max_days))
        if booking_start > latest:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Записатись можна не більше ніж на {int(max_days)} днів наперед",
            )

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
        select(Service).where(Service.id == appointment_in.service_id, Service.business_id == appointment_in.business_id).options(selectinload(Service.addons))
    )
    service = srv_res.scalars().first()

    # Додаткові послуги: тривалість і ціна.
    #
    # Перевіряємо, що кожна справді належить ЦІЙ послузі: інакше клієнт
    # міг би передати будь-який id і додати до візиту те, чого заклад
    # не пропонував - або чужу послугу з іншого закладу.
    addon_ids: list[int] = []
    addon_minutes = 0
    addon_price = Decimal("0")

    if appointment_in.addon_service_ids and service:
        allowed = {a.id for a in (service.addons or [])}
        wanted = [int(i) for i in appointment_in.addon_service_ids if int(i) in allowed]
        if wanted:
            addons_res = await db.execute(select(Service).where(Service.id.in_(wanted)))
            for addon in addons_res.scalars().all():
                addon_ids.append(addon.id)
                addon_minutes += addon.duration_minutes or 0
                addon_price += Decimal(str(addon.price or 0))

    total_minutes = (service.duration_minutes if service else 60) + addon_minutes

    # Застосування подарункового сертифіката - зменшує ціну, не робить
    # бронювання безкоштовним понад залишок сертифіката.
    applied_certificate = None
    final_price = (Decimal(str(service.price or 0)) if service else Decimal("0")) + addon_price
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
        requested_end_time = appointment_in.start_time + timedelta(minutes=total_minutes)
        appointment = Appointment(
            business_id=appointment_in.business_id,
            service_id=appointment_in.service_id,
            master_id=normalize_master_id(appointment_in.master_id),
            client_id=resolved_client_id,
            session_token=appointment_in.session_token,
            start_time=appointment_in.start_time,
            end_time=requested_end_time,
            addon_service_ids=addon_ids or None,
            # auto_approve - налаштування закладу, яке досі нічого не робило:
            # запис завжди ставав підтвердженим. Тепер, якщо автопідтвердження
            # вимкнене, візит чекає на рішення закладу.
            status="confirmed" if auto_approve else "pending_approval",
            price=final_price,
            client_name=appointment_in.client_name,
            client_phone=appointment_in.client_phone,
            client_email=appointment_in.client_email,
            source=resolved_source,
            deposit_due=deposit_due,
            manage_token=secrets.token_urlsafe(24),
            created_at=now,
        )
        db.add(appointment)
    else:
        appointment.status = "confirmed" if auto_approve else "pending_approval"
        appointment.expires_at = None
        appointment.client_id = resolved_client_id
        appointment.price = final_price
        appointment.client_name = appointment_in.client_name
        appointment.client_phone = appointment_in.client_phone
        appointment.client_email = appointment_in.client_email
        appointment.deposit_due = deposit_due
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

    # Імʼя майстра для листа. «Будь-який вільний» - чесніше за порожній
    # рядок: клієнт має розуміти, що конкретну людину не закріплено.
    # Поле в моделі називається master_id (не staff_id) - я щойно
    # переплутав і зламав 13 тестів; лишаю коментар, бо назва
    # неочевидна на тлі staff_id в інших таблицях.
    master_display_name = ""
    if appointment.master_id:
        m_res = await db.execute(select(User).where(User.id == str(appointment.master_id)))
        master = m_res.scalars().first()
        master_display_name = (master.full_name or "") if master else ""

    total_minutes = int((appointment.end_time - appointment.start_time).total_seconds() // 60)
    hours, minutes = divmod(max(total_minutes, 0), 60)
    duration_text = " ".join(filter(None, [
        f"{hours} год" if hours else "",
        f"{minutes} хв" if minutes else "",
    ]))

    # Сповіщення ЗАКЛАДУ. Раніше лист ішов лише клієнту, а заклад
    # дізнавався про запис, коли відкривав календар - для майстра без
    # адміністратора це означало сюрприз або прогаяного клієнта.
    #
    # Адресат: пошта закладу, а якщо її немає - власника. Слати всім
    # підряд не варто: майстру не потрібні чужі записи.
    if notify.get("notify_staff_booking", True) is not False and business:
        staff_email = business.email
        if not staff_email and business.owner_id:
            owner_res = await db.execute(select(User).where(User.id == str(business.owner_id)))
            owner = owner_res.scalars().first()
            staff_email = owner.email if owner else None

        if staff_email:
            background_tasks.add_task(
                send_new_booking_to_staff,
                to_email=staff_email,
                business_name=business.name,
                client_name=appointment_in.client_name or "",
                client_phone=appointment_in.client_phone or "",
                service_name=service.name if service else "Візит",
                booking_date=appointment.start_time.strftime("%d.%m.%Y"),
                booking_time=appointment.start_time.strftime("%H:%M"),
                master_name=master_display_name,
                needs_approval=not auto_approve,
            )

    # Фонова відправка листа клієнту через SMTP
    if notify_client and appointment_in.client_email and business and service:
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
            # Політику скасування й передоплату клієнт має побачити
            # в листі, а не дізнатись на місці.
            cancellation_policy=rules.get("cancellation_policy") or "",
            deposit_due=float(deposit_due) if deposit_due else None,
            master_name=master_display_name,
            duration_minutes=service.duration_minutes,
            business_phone=business.phone or "",
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

    # Підтягуємо назви: id послуги нічого не каже людині, яка відкрила
    # посилання з листа. Вона має бачити, КУДИ й ДО КОГО йде.
    response = AppointmentResponse.model_validate(appointment, from_attributes=True)

    biz_res = await db.execute(select(Business).where(Business.id == appointment.business_id))
    business = biz_res.scalars().first()
    if business:
        response.business_name = business.name

    if appointment.service_id:
        srv_res = await db.execute(select(Service).where(Service.id == appointment.service_id))
        service = srv_res.scalars().first()
        if service:
            response.service_name = service.name

    if appointment.master_id:
        m_res = await db.execute(select(User).where(User.id == str(appointment.master_id)))
        master = m_res.scalars().first()
        if master:
            response.master_name = master.full_name

    return response


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
    include_cancelled: bool = Query(True, description="Чи включати скасовані записи"),
    db: AsyncSession = Depends(get_db),
    _current_user: CurrentUser = Depends(require_business_access),
):
    # Майстер бачить ЛИШЕ свій розклад.
    #
    # Чужі записи, контакти чужих клієнтів і чужі візити його не
    # стосуються. Раніше обмеження було тільки на рівні вкладок у CRM -
    # майстер відкривав календар і бачив увесь заклад.
    #
    # Перевірка тут, а не на екрані: приховане на фронтенді все одно
    # приходить у відповіді, і будь-хто побачить його у вкладці
    # «Мережа» браузера.
    if await is_limited_to_own_schedule(db, _current_user, business_id):
        master_id = str(_current_user.id)

    # ВАЖЛИВО: цей ендпоінт віддає ім'я, телефон і email клієнтів.
    # Раніше був доступний без жодної авторизації - будь-хто, хто знав
    # business_id, міг вивантажити всі контакти клієнтів закладу.
    now = get_utc_now()

    # 'completed' і 'cancelled' раніше не потрапляли у відповідь узагалі -
    # завершені візити зникали з календаря, а скасовані неможливо було
    # перевірити («хто і коли скасував»). Тепер вони приходять, а CRM
    # сама вирішує, як їх показати (приглушено, окремим фільтром тощо).
    #
    # Не віддаємо лише 'pending': це недопідтверджені блокування слоту,
    # службовий стан на 15 хвилин, який нічого не означає для календаря.
    # 'late' і 'no-show' теж мають повертатись: без них запис ЗНИКАВ би
    # з календаря одразу після того, як його позначили запізненням.
    # pending_approval - записи, що чекають на підтвердження закладу
    # (коли автопідтвердження вимкнене). Без них заклад НЕ ПОБАЧИТЬ,
    # що хтось намагався записатись - і запит просто загубиться.
    statuses = ["confirmed", "completed", "cancelled", "late", "no-show", "pending_approval"]
    if include_cancelled is False:
        statuses.remove("cancelled")

    # Блокування часу.
    #
    # ГОЛОВНИЙ БАГ, який це виправляє: умова була
    # `status == "blocked" AND expires_at > now`. Але expires_at - це
    # поле ТИМЧАСОВОГО замка слота на 15 хвилин, поки клієнт заповнює
    # форму бронювання.
    #
    # Постійні блокування від закладу (обід, перерва, ремонт) його не
    # мають узагалі - expires_at у них NULL, і порівняння NULL > now
    # завжди хибне. Тому заклад блокував час, бачив його на екрані,
    # перезавантажував сторінку - і блокування зникало назавжди.
    #
    # Тепер повертаємо і постійні (expires_at IS NULL), і тимчасові,
    # які ще не спливли.
    query = select(Appointment).where(
        Appointment.business_id == business_id,
        or_(
            Appointment.status.in_(statuses),
            and_(
                Appointment.status == "blocked",
                or_(
                    Appointment.expires_at.is_(None),
                    Appointment.expires_at > now,
                ),
            ),
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

    previous_status = appointment.status
    _old_status = appointment.status
    appointment.status = payload.status
    # Бонуси BookEra: нарахувати за завершений візит або повернути,
    # якщо позначку «завершено» зняли.
    from app.services.bonuses import sync_visit_bonus
    await sync_visit_bonus(db, appointment, _old_status)

    if payload.status == "completed":
        biz_res = await db.execute(select(Business).where(Business.id == appointment.business_id))
        business = biz_res.scalars().first()
        if business:
            await charge_commission_if_applicable(db, appointment, business)
        # Списуємо матеріали зі складу за фактом наданої послуги
        await consume_materials_for_appointment(db, appointment)
    elif previous_status == "completed" and payload.status in ("cancelled", "confirmed"):
        # Візит помилково позначили завершеним - повертаємо матеріали,
        # інакше залишки на складі зникали б безслідно.
        await revert_materials_for_appointment(db, appointment)

    await db.commit()
    await db.refresh(appointment)
    return appointment

@router.get("/my", response_model=List[MyAppointmentResponse])
async def list_my_appointments(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Записи поточного користувача - для сторінки профілю.

    Раніше профіль читав базу НАПРЯМУ через Supabase і шукав записи за
    `user_id.eq.{id}` або `client_id.eq.{id}`. Обидві умови хибні:
    поля user_id в записах немає взагалі, а client_id посилається на
    клієнта ЗАКЛАДУ - це інший ідентифікатор, ніж обліковий запис.
    Тому список був порожній завжди.

    Шукаємо за поштою й телефоном. Це єдине, що пов'язує обліковий
    запис із візитом: людина записується як гість, вводить контакти,
    і жодного зв'язку з її акаунтом при цьому не виникає.

    Телефон порівнюємо за останніми 9 цифрами: той самий номер
    зустрічається як +380671112233, 0671112233 і 380671112233.
    """
    res = await db.execute(select(User).where(User.id == str(current_user.id)))
    user = res.scalars().first()

    email = (user.email if user else None) or current_user.email
    phone_digits = "".join(ch for ch in ((user.phone if user else "") or "") if ch.isdigit())

    conditions = []
    if email:
        conditions.append(func.lower(Appointment.client_email) == email.lower())
    if len(phone_digits) >= 9:
        conditions.append(Appointment.client_phone.like(f"%{phone_digits[-9:]}"))

    if not conditions:
        return []

    result = await db.execute(
        select(Appointment)
        .where(
            or_(*conditions),
            # Технічні замки слотів - не записи людини.
            Appointment.status != "blocked",
        )
        .order_by(Appointment.start_time.desc())
        .limit(200)
    )
    appointments = result.scalars().all()

    # Назви закладу й послуги: без них профіль показує дати без натяку,
    # куди саме людина ходила.
    out = []
    # Які візити вже оцінено - одним запитом на всі, а не по одному.
    from app.models.extras import Review
    reviewed: set[int] = set()
    if appointments:
        rv = await db.execute(
            select(Review.appointment_id).where(Review.appointment_id.in_([a.id for a in appointments]))
        )
        reviewed = {row[0] for row in rv.all() if row[0] is not None}

    # Усі повʼязані дані - ЧОТИРМА запитами на весь список.
    #
    # Раніше - 3-4 запити на КОЖЕН візит (заклад, послуга, майстер,
    # додаткові послуги), послідовно. До 200 візитів - до 800 запитів
    # один за одним при кожному відкритті профілю: чим довша історія,
    # тим повільніше. Тепер кількість запитів не залежить від історії.
    biz_ids = {a.business_id for a in appointments if a.business_id}
    srv_ids = {a.service_id for a in appointments if a.service_id}
    for a in appointments:
        srv_ids.update(a.addon_service_ids or [])
    master_ids = {str(a.master_id) for a in appointments if a.master_id}

    businesses = {}
    if biz_ids:
        rows = await db.execute(select(Business).where(Business.id.in_(biz_ids)))
        businesses = {b.id: b for b in rows.scalars().all()}
    services_by_id = {}
    if srv_ids:
        rows = await db.execute(select(Service).where(Service.id.in_(srv_ids)))
        services_by_id = {s.id: s for s in rows.scalars().all()}
    masters = {}
    if master_ids:
        rows = await db.execute(select(User).where(User.id.in_(master_ids)))
        masters = {str(u.id): u for u in rows.scalars().all()}

    for appointment in appointments:
        response = MyAppointmentResponse.model_validate(appointment, from_attributes=True)
        response.manage_token = appointment.manage_token
        response.has_review = appointment.id in reviewed

        business = businesses.get(appointment.business_id)
        if business:
            response.business_name = business.name
            # Дані для картки візиту: людина має розуміти, КУДИ їй їхати
            # і як звʼязатись, не відкриваючи сторінку закладу.
            response.business_slug = business.slug
            response.business_address = ", ".join(x for x in [business.city, business.address] if x)
            response.business_phone = business.phone if business.show_phone_publicly is not False else None
            response.business_photo = business.cover_photo or business.logo

        service = services_by_id.get(appointment.service_id) if appointment.service_id else None
        if service:
            response.service_name = service.name

        # Майстер: перше питання після «коли» - до кого саме.
        master = masters.get(str(appointment.master_id)) if appointment.master_id else None
        if master:
            response.master_name = master.full_name

        # Додаткові послуги: вони вже в ціні й тривалості, тож людина
        # має бачити, за що заплатила.
        if appointment.addon_service_ids:
            response.addon_names = [
                services_by_id[i].name for i in appointment.addon_service_ids if i in services_by_id
            ]

        out.append(response)

    return out


@router.get("/nearest-slots")
async def get_nearest_slots(
    business_id: int = Query(...),
    days: int = Query(14, ge=1, le=31),
    db: AsyncSession = Depends(get_db),
):
    """
    Найближче вільне вікно для КОЖНОЇ послуги закладу - одним запитом.

    Раніше сторінка салону шукала їх сама: до 12 послуг x до 14 днів,
    кожен день - окремий HTTP-запит, і ВСІ ПОСЛІДОВНО, бо наступний
    чекав на попередній. У гіршому випадку - 168 запитів у черзі при
    кожному відкритті сторінки.

    Тут та сама логіка слотів викликається всередині сервера, без
    мережі між кроками. Для кожної послуги - від сьогодні вперед,
    до першого вільного вікна: зазвичай це перший же день.

    Відповідь: {service_id: "YYYY-MM-DDTHH:MM"}. Послуги без вільного
    вікна в межах days у відповідь не потрапляють.
    """
    services_res = await db.execute(
        select(Service).where(Service.business_id == business_id).order_by(Service.id).limit(12)
    )
    services = services_res.scalars().all()

    result: dict[str, str] = {}
    today = local_now().date()

    for service in services:
        for offset in range(days):
            target = today + timedelta(days=offset)
            try:
                data = await get_available_slots(
                    business_id=business_id,
                    service_id=service.id,
                    target_date=target,
                    master_id="0",
                    step_minutes=None,
                    duration_minutes=None,
                    db=db,
                )
            except HTTPException:
                # Послуга недоступна (заклад на паузі, немає майстрів) -
                # далі шукати немає сенсу.
                break

            free = next((s for s in data.slots if s.status == "available"), None)
            if free:
                result[str(service.id)] = f"{target.isoformat()}T{str(free.time)[:5]}"
                break

    return result


@router.get("/today-slots")
async def get_today_slots(
    business_ids: str = Query(..., description="id закладів через кому"),
    target_date: date = Query(...),
    limit: int = Query(3, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    """
    Перші вільні години на дату - для кількох закладів одним запитом.

    Раніше головна робила окремий запит на кожну картку: дванадцять
    запитів при кожному відкритті сторінки. Паралельних, але кожен зі
    своїми накладними витратами - зʼєднання, заголовки, черга браузера
    (він тримає лише кілька одночасних запитів до одного сервера).

    Для кожного закладу береться послуга з найменшим id - та сама
    «основна», що й на картці. Відповідь: {business_id: ["10:00", ...]}.
    Заклад без послуг чи без вільних годин - порожній список.
    """
    try:
        ids = [int(x) for x in business_ids.split(",") if x.strip()][:24]
    except ValueError:
        raise HTTPException(status_code=400, detail="business_ids мають бути числами через кому")

    if not ids:
        return {}

    services_res = await db.execute(
        select(Service).where(Service.business_id.in_(ids)).order_by(Service.business_id, Service.id)
    )
    primary: dict[int, int] = {}
    for s in services_res.scalars().all():
        primary.setdefault(s.business_id, s.id)

    result: dict[str, list[str]] = {}
    for bid in ids:
        service_id = primary.get(bid)
        if not service_id:
            result[str(bid)] = []
            continue
        try:
            data = await get_available_slots(
                business_id=bid,
                service_id=service_id,
                target_date=target_date,
                master_id="0",
                step_minutes=None,
                duration_minutes=None,
                db=db,
            )
            result[str(bid)] = [str(s.time)[:5] for s in data.slots if s.status == "available"][:limit]
        except HTTPException:
            # Заклад на паузі чи без майстрів - просто без годин, решта
            # карток від цього не страждає.
            result[str(bid)] = []

    return result


class ClientReviewRequest(BaseModel):
    token: str
    rating: int
    comment: Optional[str] = None


@router.post("/{appointment_id}/review")
async def create_review_by_client(
    appointment_id: int,
    payload: ClientReviewRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Відгук клієнта на власний завершений візит.

    Модель відгуків була, але клієнт не мав як її заповнити - тож усі
    заклади лишались «Новий заклад», а рейтинг стояв на типовому значенні.

    Доступ за токеном керування записом (той самий, що для перенесення):
    відгук може залишити лише той, хто справді був на візиті.

    Один відгук на візит. Після збереження рейтинг і кількість відгуків
    закладу перераховуються з усіх його відгуків - раніше їх не
    оновлювало ніщо.
    """
    from app.models.extras import Review

    if not 1 <= payload.rating <= 5:
        raise HTTPException(status_code=400, detail="Оцінка має бути від 1 до 5")

    comment = (payload.comment or "").strip()[:1000] or None

    res = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = res.scalars().first()
    if not appointment or not appointment.manage_token or appointment.manage_token != payload.token:
        raise HTTPException(status_code=404, detail="Візит не знайдено")

    if appointment.status != "completed":
        raise HTTPException(status_code=409, detail="Відгук можна залишити лише після візиту")

    existing = await db.execute(select(Review).where(Review.appointment_id == appointment.id))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Ви вже оцінили цей візит")

    db.add(Review(
        business_id=appointment.business_id,
        appointment_id=appointment.id,
        author_name=appointment.client_name,
        rating=payload.rating,
        comment=comment,
    ))
    await db.flush()

    # Рейтинг - середнє всіх відгуків закладу, з одним знаком.
    stats = await db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(Review.business_id == appointment.business_id)
    )
    avg, count = stats.one()
    biz = await db.get(Business, appointment.business_id)
    if biz:
        biz.rating = round(float(avg), 1) if avg is not None else None
        biz.reviews_count = int(count)

    await db.commit()
    return {"ok": True, "rating": biz.rating if biz else None, "reviews_count": biz.reviews_count if biz else None}


class ClientRescheduleRequest(BaseModel):
    token: str
    start_time: datetime


@router.post("/{appointment_id}/reschedule", response_model=AppointmentResponse)
async def reschedule_appointment_by_client(
    appointment_id: int,
    payload: ClientRescheduleRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Клієнт переносить власний запис - за токеном керування записом.

    Раніше профіль звертався до маршруту кабінету закладу, куди клієнт
    доступу не має, отримував відмову й «переносив» напряму в базі, в
    обхід сервера - правила доступу це блокували, але інтерфейс уже
    показував успіх. Запис лишався на старому часі, а людина думала,
    що перенесла.

    Новий час перевіряється тими самими правилами, що й нове
    бронювання: робочі години, перерви, інші записи - у ТОГО САМОГО
    майстра й на ту саму тривалість.
    """
    res = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = res.scalars().first()
    if not appointment or not appointment.manage_token or appointment.manage_token != payload.token:
        raise HTTPException(status_code=404, detail="Запис не знайдено")

    if appointment.status not in ("confirmed", "pending_approval"):
        raise HTTPException(status_code=409, detail="Цей запис уже не можна перенести")

    new_start = payload.start_time.replace(tzinfo=None, second=0, microsecond=0)
    if new_start <= local_now().replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Оберіть час у майбутньому")

    duration = (appointment.end_time - appointment.start_time) if appointment.end_time else timedelta(hours=1)
    minutes = max(5, int(duration.total_seconds() // 60))

    slots = await get_available_slots(
        business_id=appointment.business_id,
        service_id=appointment.service_id,
        target_date=new_start.date(),
        master_id=str(appointment.master_id) if appointment.master_id else "0",
        step_minutes=None,
        duration_minutes=minutes,
        db=db,
    )
    wanted = new_start.strftime("%H:%M")
    if not any(str(s.time)[:5] == wanted and s.status == "available" for s in slots.slots):
        raise HTTPException(status_code=409, detail="Цей час уже зайнятий - оберіть інший")

    appointment.start_time = new_start
    appointment.end_time = new_start + timedelta(minutes=minutes)
    await db.commit()
    await db.refresh(appointment)
    return appointment
