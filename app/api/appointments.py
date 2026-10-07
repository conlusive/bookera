from datetime import date, datetime, time, timedelta
from decimal import Decimal
import os
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.appointment import AppointmentStatusUpdate, MyAppointmentResponse
from app.services.payments import online_payments_available

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, assert_can_modify_appointment, get_current_user, require_business_access, is_limited_to_own_schedule
from app.core.rate_limit import rate_limit, tokens_equal
from app.models import Business, User, RoleEnum, Appointment, Service, BookingSourceEnum, BusinessHours, GiftCertificate, Client, Payment
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentResponse,
    BookingCreatedResponse,
    AvailableSlotsResponse,
    LockSlotRequest,
    ManageBookingRequest,
    SlotStatusItem,
)
from app.core.email import send_booking_confirmation_email, send_new_booking_to_staff
from app.services.subscription import has_access
from app.services.monetization import award_points_for_new_client

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

router = APIRouter(prefix="/appointments", tags=["Appointments"])

LOCK_TIMEOUT_MINUTES = 10


from app.core.time_utils import utc_now as get_utc_now, local_now


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

def _on_shift(shifts, day, start_mins: int, end_mins: int) -> bool:
    """
    Чи працює майстер у цей проміжок за своїм графіком (User.shifts).

    Формат - 7 днів від понеділка: {active, start "HH:MM", end "HH:MM"}.
    Графіка немає чи він зіпсований - вважаємо, що майстер працює в години
    закладу: так поводилась система раніше, і нічого не зламається для
    тих, хто графік не заповнював.
    """
    if isinstance(shifts, str):
        try:
            import json
            shifts = json.loads(shifts)
        except Exception:
            return True
    if not isinstance(shifts, list) or len(shifts) != 7:
        return True
    shift = shifts[day.weekday()] or {}
    if not shift.get("active", True):
        return False
    try:
        s = parse_hhmm_to_minutes(shift.get("start") or "00:00")
        e = parse_hhmm_to_minutes(shift.get("end") or "23:59")
    except Exception:
        return True
    return s <= start_mins and end_mins <= e


async def _notify_team(db: AsyncSession, background_tasks: BackgroundTasks, appointment, title: str, extra_rows: list) -> None:
    """
    Скасування чи перенесення клієнтом - листом майстрові й закладу.
    Раніше не повідомляли нікого: салон дізнавався, лише коли зазирав у
    календар, а майстер чекав на клієнта, який уже скасував.
    """
    from app.core.email import send_staff_notice
    business = await db.get(Business, appointment.business_id)
    if not business:
        return
    service = await db.get(Service, appointment.service_id) if appointment.service_id else None
    rows = [("Клієнт", appointment.client_name or "Без імені", False),
            ("Послуга", service.name if service else "Візит", False)] + extra_rows
    to = set()
    if business.email:
        to.add(business.email.lower())
    elif business.owner_id:
        owner = (await db.execute(select(User).where(User.id == str(business.owner_id)))).scalars().first()
        if owner and owner.email:
            to.add(owner.email.lower())
    if appointment.master_id:
        m = (await db.execute(select(User).where(User.id == str(appointment.master_id)))).scalars().first()
        if m and m.email:
            to.add(m.email.lower())
    for email in to:
        background_tasks.add_task(send_staff_notice, email, business.name, title, rows, "")


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

    # Правила онлайн-запису (app/services/booking_rules.py): ті самі, що й у
    # створенні запису. Без цього слоти показували час, який запис відхиляв.
    from app.services import booking_rules
    _rules = business.booking_settings or {}
    _empty = AvailableSlotsResponse(
        date=target_date, service_id=service.id, duration_minutes=service.duration_minutes,
        slots=[], server_time=local_time_now.strftime("%Y-%m-%d %H:%M"),
    )
    if booking_rules.booking_disabled(_rules) or booking_rules.closed_period_reason(_rules, target_date):
        return _empty
    _late = booking_rules.latest_start(_rules, local_time_now)
    if _late and datetime.combine(target_date, time(0, 0)) > _late:
        return _empty
    _early = booking_rules.earliest_start(_rules, local_time_now)

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
    # Майстри закладу - за ЧЛЕНСТВОМ, а не за «поточним закладом»
    # (User.business_id). Раніше майстер, що перемкнувся в інший салон,
    # для цього зникав - і до нього неможливо було записатись.
    from app.models import StaffMembership
    memberships = {
        m.user_id: m for m in (await db.execute(
            select(StaffMembership).where(
                StaffMembership.business_id == business_id,
                StaffMembership.is_active.is_(True),
                StaffMembership.role.in_(["master", "vendor"]),
            )
        )).scalars().all()
    }
    masters_query = select(User).where(
        or_(
            User.id.in_(list(memberships) or [""]),
            and_(User.business_id == business_id, or_(User.role == RoleEnum.MASTER, User.role == RoleEnum.VENDOR)),
        ),
        User.is_active.is_(True),
    )
    if master_id not in ("0", "", None, "null"):
        masters_query = masters_query.where(User.id == master_id)

    masters_res = await db.execute(masters_query)
    active_masters = masters_res.scalars().all()
    if master_id in ("0", "", None, "null"):
        # «Будь-який майстер»: лише ті, хто виконує цю послугу (як і при резерві слота)
        offering = [m for m in active_masters if _offers_service(m, service)]
        active_masters = offering if offering or not active_masters else []

    # 1.5 Отримуємо всі записи на цей день
    day_start = datetime.combine(target_date, time(0, 0, 0))
    day_end = datetime.combine(target_date, time(23, 59, 59))

    appointments_query = select(Appointment).where(
        Appointment.business_id == business_id,
        Appointment.start_time >= day_start,
        Appointment.start_time <= day_end,
        or_(
            # Запис, що чекає підтвердження власника, теж тримає час:
            # раніше на нього можна було записатись удруге.
            # time_off - особистий час майстра (перерва, справи).
            Appointment.status.in_(["confirmed", "pending_approval", "time_off"]),
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
        # «Не раніше ніж за N годин» і «не далі ніж на N днів»
        if (_early and slot_start_dt < _early) or (_late and slot_start_dt > _late):
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
                    # Графік майстра: не на зміні - для клієнта він зайнятий.
                    # Раніше графік на сервері не враховувався зовсім, і до
                    # майстра можна було записатись навіть у його вихідний.
                    # Графік У ЦЬОМУ ЗАКЛАДІ (членство); немає - старий особистий.
                    _mem = memberships.get(str(m.id))
                    _shifts = _mem.shifts if _mem is not None and _mem.shifts is not None else m.shifts
                    if not _on_shift(_shifts, target_date, current_mins, current_mins + duration):
                        continue
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



async def _team_for_booking(db: AsyncSession, business_id: int):
    """Майстри закладу для запису: за членством (як у /available-slots) плюс «старі» за User.business_id."""
    from app.models import StaffMembership
    memberships = {
        m.user_id: m for m in (await db.execute(
            select(StaffMembership).where(
                StaffMembership.business_id == business_id,
                StaffMembership.is_active.is_(True),
                StaffMembership.role.in_(["master", "vendor"]),
            )
        )).scalars().all()
    }
    masters = (await db.execute(
        select(User).where(
            or_(
                User.id.in_(list(memberships) or [""]),
                and_(User.business_id == business_id, or_(User.role == RoleEnum.MASTER, User.role == RoleEnum.VENDOR)),
            ),
            User.is_active.is_(True),
        ).order_by(User.id)
    )).scalars().all()
    return masters, memberships


def _offers_service(master, service) -> bool:
    """Чи виконує майстер послугу: прапорець «надає послуги» і, якщо список послуг заповнений, вона в ньому."""
    if getattr(master, "provides_services", True) is False:
        return False
    assigned = getattr(master, "assigned_services", None)
    if isinstance(assigned, list) and assigned:
        try:
            return int(service.id) in {int(x) for x in assigned}
        except (TypeError, ValueError):
            return True
    return True


async def _pick_master(
    db: AsyncSession, business_id: int, service, start: datetime, end: datetime, now: datetime,
    *, buffer_minutes: int = 0, session_token: Optional[str] = None, only_master_id: Optional[str] = None,
):
    """
    Вибір майстра для запису - одна логіка для резерву слота й створення запису, узгоджена з /available-slots.

    Повертає (master_id, has_masters). Майстер підходить, якщо він надає цю послугу, працює за своїм графіком
    у цей час і не має накладок (підтверджені, очікують, особистий час, чужі резерви й перерви). Власний резерв
    цієї ж сесії не заважає. Із кількох вільних береться той, у кого цього дня найменше записів - щоб «будь-який
    майстер» не вантажив завжди першого за списком. has_masters=False - у закладі немає майстрів (запис за закладом).
    """
    start = start.replace(tzinfo=None)
    end = end.replace(tzinfo=None)
    masters, memberships = await _team_for_booking(db, business_id)
    if only_master_id is not None:
        candidates = [m for m in masters if str(m.id) == str(only_master_id)]
        if not candidates:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Майстра не знайдено")
    else:
        candidates = [m for m in masters if _offers_service(m, service)]
        if masters and not candidates:
            return None, True
    if not masters:
        return None, False

    day_start = datetime.combine(start.date(), time(0, 0))
    day_apps = (await db.execute(
        select(Appointment).where(
            Appointment.business_id == business_id,
            Appointment.start_time >= day_start,
            Appointment.start_time < day_start + timedelta(days=1),
            or_(
                Appointment.status.in_(["confirmed", "pending_approval", "time_off"]),
                and_(Appointment.status == "blocked", or_(Appointment.expires_at.is_(None), Appointment.expires_at > now)),
            ),
        )
    )).scalars().all()
    if session_token:
        day_apps = [a for a in day_apps if not (a.status == "blocked" and a.session_token == session_token)]

    occupied_end = end + timedelta(minutes=buffer_minutes)
    smins, emins = start.hour * 60 + start.minute, start.hour * 60 + start.minute + int((end - start).total_seconds() // 60)
    free = []
    for m in candidates:
        mem = memberships.get(str(m.id))
        shifts = mem.shifts if mem is not None and mem.shifts is not None else m.shifts
        if not _on_shift(shifts, start.date(), smins, emins):
            continue
        if any(str(a.master_id) == str(m.id) and a.start_time < occupied_end and a.end_time > start for a in day_apps):
            continue
        free.append(m)
    if not free:
        return None, True
    load: dict[str, int] = {}
    for a in day_apps:
        if a.master_id and a.status in ("confirmed", "pending_approval"):
            load[str(a.master_id)] = load.get(str(a.master_id), 0) + 1
    free.sort(key=lambda m: (load.get(str(m.id), 0), str(m.id)))
    return str(free[0].id), True


def _buffer_of(business) -> int:
    raw = (business.booking_settings or {}).get("buffer_minutes") if business else None
    return int(raw) if isinstance(raw, (int, float)) and 0 <= raw <= 60 else 0


# === 2. БЛОКУВАННЯ ТА РОЗБЛОКУВАННЯ ===

def _is_slot_race(exc: DBAPIError) -> bool:
    """
    Дві одночасні вставки на один слот: БД віддає або порушення exclusion constraint,
    або deadlock (SQLSTATE 40P01), залежно від того, хто кого встиг дочекатись. Для
    клієнта це одне й те саме - «час щойно зайняли», а не помилка сервера.
    """
    return getattr(exc.orig, "sqlstate", None) == "40P01"


@router.post("/lock")
async def lock_time_slot(
    request: LockSlotRequest,
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),  # бронювання лише для зареєстрованих
    _rl=Depends(rate_limit("lock", max_requests=20, window_seconds=60)),
):
    now = get_utc_now()
    from app.services.deposits import expire_unpaid_deposits
    await expire_unpaid_deposits(db, request.business_id)  # слоти без сплаченого завдатку знову вільні

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
    assigned_master_id = normalize_master_id(master_id)

    if not service.is_group:
        biz_for_lock = (await db.execute(select(Business).where(Business.id == request.business_id))).scalars().first()
        picked, has_masters = await _pick_master(
            db, request.business_id, service, request.start_time, requested_end_time, now,
            buffer_minutes=_buffer_of(biz_for_lock), session_token=request.session_token,
            only_master_id=assigned_master_id,
        )
        if has_masters and not picked:
            # Усі підхожі майстри зайняті або не працюють: резерв без майстра дав би «подвійний запис» поза БД-захистом
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Цей час щойно зайняли.")
        if has_masters:
            assigned_master_id = picked

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
        # Справжнє джерело сервер визначає при підтвердженні запису (за токеном); тут - лише чесне значення за замовчуванням.
        # Раніше str(enum) давав у базі рядок «BookingSourceEnum.DIRECT».
        source=BookingSourceEnum.MARKETPLACE.value,
        price=service.price,
        created_at=now,
        expires_at=now + timedelta(minutes=LOCK_TIMEOUT_MINUTES),
    )
    db.add(new_lock)
    try:
        await db.commit()
    except (IntegrityError, DBAPIError) as exc:
        if not isinstance(exc, IntegrityError) and not _is_slot_race(exc):
            raise
        # Спрацював exclusion constraint на рівні БД (no_overlapping_bookings) -
        # хтось інший щойно зайняв цей самий слот між нашою перевіркою і вставкою.
        # Це і є справжній, надійний захист від подвійного бронювання: перевірка
        # в Python вище - лише оптимізація, щоб не чекати зайвий round-trip у типовому випадку.
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Цей час щойно зайняли.")
    await db.refresh(new_lock)

    return {"status": "success", "booking_id": new_lock.id, "message": "Заблоковано на 10 хвилин"}


@router.post("/unlock")
async def unlock_time_slot(request: LockSlotRequest, db: AsyncSession = Depends(get_db), _user: CurrentUser = Depends(get_current_user), _rl=Depends(rate_limit("unlock", max_requests=60, window_seconds=60))):
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

@router.post("", response_model=BookingCreatedResponse)
async def create_appointment(
    appointment_in: AppointmentCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),  # запис лише для зареєстрованих, як і в інтерфейсі
    _rl=Depends(rate_limit("book", max_requests=12, window_seconds=600))
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

    from app.services import booking_rules
    off = booking_rules.booking_disabled(rules)
    if off:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=off)
    closed = booking_rules.closed_period_reason(rules, appointment_in.start_time.date())
    if closed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=closed)

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

    # Місцевий час закладу, а не UTC: booking_start - теж місцевий.
    too_soon_or_far = booking_rules.advance_violation(rules, booking_start, local_now(business_for_rules).replace(tzinfo=None))
    if too_soon_or_far:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=too_soon_or_far)

    from app.services.deposits import expire_unpaid_deposits
    await expire_unpaid_deposits(db, appointment_in.business_id)

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
    ask_marketing = False
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
                # Онлайн-запис - лише за згодою: без галочки клієнт у розсилки не потрапляє
                marketing_consent=bool(appointment_in.marketing_consent),
            )
            db.add(crm_client)
            await db.flush()
            await award_points_for_new_client(db, business, appointment_in.client_phone, crm_client.id)
        elif appointment_in.marketing_consent and crm_client.marketing_consent is not True:
            # Згоду можна лише дати цим записом; мовчки забрати її (галочка не стоїть) - ні
            crm_client.marketing_consent = True
        resolved_client_id = crm_client.id
        # Питання про розсилку - вже ПІСЛЯ підтвердженого запису (вікно на сайті), а не галочкою в формі.
        # Питаємо лише тих, кого ще не питали й хто не погодився; пошта потрібна, інакше розсилати нічого.
        ask_marketing = bool(appointment_in.client_email) and crm_client.marketing_asked_at is None and crm_client.marketing_consent is not True

    deposit_due = booking_rules.deposit_for(payments, final_price)

    if not appointment:
        # Створюємо прямий запис, якщо блоку не було
        requested_end_time = appointment_in.start_time + timedelta(minutes=total_minutes)
        # Без резерву майстра обирає сервер за тими ж правилами, що й при резерві слота
        direct_master = normalize_master_id(appointment_in.master_id)
        if service and not service.is_group:
            picked, has_masters = await _pick_master(
                db, appointment_in.business_id, service, appointment_in.start_time, requested_end_time, now,
                buffer_minutes=_buffer_of(business), session_token=appointment_in.session_token, only_master_id=direct_master,
            )
            if has_masters and not picked:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Цей час щойно зайняли.")
            if has_masters:
                direct_master = picked
        appointment = Appointment(
            business_id=appointment_in.business_id,
            service_id=appointment_in.service_id,
            master_id=direct_master,
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
            deposit_status="awaiting" if (deposit_due and online_payments_available()) else None,
            deposit_token=secrets.token_urlsafe(18) if (deposit_due and online_payments_available()) else None,
            manage_token=secrets.token_urlsafe(24),
            created_at=now,
        )
        db.add(appointment)
    else:
        appointment.status = "confirmed" if auto_approve else "pending_approval"
        appointment.expires_at = None
        # Резерв тримав лише основну послугу: додаткові послуги подовжують візит і мають лишитись у записі
        appointment.end_time = appointment.start_time + timedelta(minutes=total_minutes)
        appointment.addon_service_ids = addon_ids or None
        appointment.client_id = resolved_client_id
        appointment.price = final_price
        appointment.client_name = appointment_in.client_name
        appointment.client_phone = appointment_in.client_phone
        appointment.client_email = appointment_in.client_email
        appointment.deposit_due = deposit_due
        appointment.deposit_status = "awaiting" if (deposit_due and online_payments_available()) else None
        appointment.deposit_token = secrets.token_urlsafe(18) if appointment.deposit_status else None
        appointment.manage_token = secrets.token_urlsafe(24)
        # source визначає сервер (resolved_source), а не клієнтське поле -
        # раніше тут лишався appointment_in.source, якого в схемі вже немає.
        appointment.source = resolved_source

    try:
        await db.commit()
    except (IntegrityError, DBAPIError) as exc:
        if not isinstance(exc, IntegrityError) and not _is_slot_race(exc):
            raise
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Цей час щойно зайняли.")
    await db.refresh(appointment)
    appointment.ask_marketing_consent = ask_marketing  # лише для відповіді, у базі цього поля немає

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

        # Майстрові - особисто, якщо в нього своя пошта. Раніше лист ішов
        # лише на пошту закладу: майстер дізнавався про клієнта, коли
        # відкривав календар.
        if appointment.master_id:
            _m = (await db.execute(select(User).where(User.id == str(appointment.master_id)))).scalars().first()
            if _m and _m.email and _m.email.lower() != (staff_email or "").lower():
                background_tasks.add_task(
                    send_new_booking_to_staff,
                    to_email=_m.email,
                    business_name=business.name,
                    client_name=appointment_in.client_name or "",
                    client_phone=appointment_in.client_phone or "",
                    service_name=service.name if service else "Візит",
                    booking_date=appointment.start_time.strftime("%d.%m.%Y"),
                    booking_time=appointment.start_time.strftime("%H:%M"),
                    master_name="",
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

    # Кого призначено - клієнт, який обрав «будь-який майстер», має це побачити одразу
    appointment.master_name = master_display_name or None
    return appointment


class MarketingConsentIn(BaseModel):
    consent: bool


@router.post("/{appointment_id}/marketing-consent")
async def answer_marketing_consent(
    appointment_id: int,
    payload: MarketingConsentIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Відповідь на питання про розсилку закладу після запису. Відповідає той, хто записався: його id збігається
    з session_token запису або пошта з поштою в записі. Згода стосується клієнта саме цього закладу.
    """
    appointment = (await db.execute(select(Appointment).where(Appointment.id == appointment_id))).scalars().first()
    me_email = (current_user.email or "").strip().lower()
    is_booker = bool(appointment) and (
        (appointment.session_token and str(appointment.session_token) == str(current_user.id))
        or (me_email and (appointment.client_email or "").strip().lower() == me_email)
    )
    if not appointment or not is_booker or not appointment.client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Бронювання не знайдено")
    client_row = (await db.execute(select(Client).where(Client.id == appointment.client_id))).scalars().first()
    if not client_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Бронювання не знайдено")
    client_row.marketing_consent = payload.consent
    client_row.marketing_asked_at = get_utc_now()
    await db.commit()
    return {"consent": payload.consent}


@router.post("/{appointment_id}/deposit/checkout")
async def checkout_deposit(
    appointment_id: int,
    payload: ManageBookingRequest,
    db: AsyncSession = Depends(get_db),
    _rl=Depends(rate_limit("manage", max_requests=30, window_seconds=600)),
):
    """
    Оплата завдатку за запис карткою - той, хто записався, за токеном керування. Суму бере сервер із запису,
    а не з запиту. Без ключів платіжки оплата тестова й проходить одразу; зі справжніми повертаємо
    підписану форму, а закриває завдаток підтвердження платіжної системи (callback dp-...).
    """
    from app.services.deposits import mark_deposit_paid
    from app.services.payments import create_payment_intent
    appointment = (await db.execute(select(Appointment).where(Appointment.id == appointment_id))).scalars().first()
    allowed = bool(appointment) and (
        (appointment.manage_token and tokens_equal(appointment.manage_token, payload.token))
        or (appointment.deposit_token and tokens_equal(appointment.deposit_token, payload.token))
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Бронювання не знайдено")
    if appointment.status == "cancelled" or appointment.deposit_status != "awaiting" or not appointment.deposit_due:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Завдаток за цей запис не потрібен або вже сплачений")
    business = (await db.execute(select(Business).where(Business.id == appointment.business_id))).scalars().first()

    order_id = f"dp-{appointment.id}-{secrets.token_hex(6)}"
    intent = create_payment_intent(
        Decimal(appointment.deposit_due), order_id, f"Завдаток за запис — {business.name if business else ''}",
        return_url=f"/my-booking/{appointment.id}?token={appointment.manage_token}",
        client_email=appointment.client_email,
    )
    payment = Payment(
        business_id=appointment.business_id, purpose="deposit", amount=Decimal(appointment.deposit_due),
        provider=intent.provider, provider_ref=order_id, status="pending",
    )
    db.add(payment)
    await db.flush()
    appointment.deposit_payment_id = payment.id
    await db.flush()  # сесія без autoflush: mark_deposit_paid шукає запис за deposit_payment_id
    paid = False
    if intent.status == "completed":
        await mark_deposit_paid(db, payment)
        paid = True
    await db.commit()
    return {"amount": float(appointment.deposit_due), "paid": paid, "checkout": intent.checkout, "checkout_url": intent.checkout_url}


@router.get("/{appointment_id}/manage", response_model=AppointmentResponse)
async def get_appointment_for_client(
    appointment_id: int,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _rl=Depends(rate_limit("manage", max_requests=60, window_seconds=600))
):
    """
    Дозволяє клієнту переглянути СВОЄ бронювання за токеном з листа -
    без потреби реєструватись/логінитись (гостьове бронювання).
    """
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalars().first()
    if not appointment or not appointment.manage_token or not tokens_equal(appointment.manage_token, token):
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
    background_tasks: BackgroundTasks,
    appointment_id: int,
    payload: ManageBookingRequest,
    db: AsyncSession = Depends(get_db),
    _rl=Depends(rate_limit("manage", max_requests=60, window_seconds=600))
):
    """Клієнт скасовує власне бронювання за токеном - без авторизації бізнесу."""
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalars().first()
    if not appointment or not appointment.manage_token or not tokens_equal(appointment.manage_token, payload.token):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Бронювання не знайдено")

    if appointment.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Це бронювання вже скасоване")
    if appointment.status == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Візит вже відбувся, скасування неможливе")
    from app.services import booking_rules
    biz = (await db.execute(select(Business).where(Business.id == appointment.business_id))).scalars().first()
    now_local = local_now(biz).replace(tzinfo=None)
    if appointment.start_time <= now_local:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Час візиту вже настав")
    too_late = booking_rules.cancel_violation((biz.booking_settings or {}) if biz else {}, appointment.start_time, now_local)
    if too_late:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=too_late)

    from app.services.visit_hooks import on_status_change
    _previous_status = appointment.status
    appointment.status = "cancelled"
    await on_status_change(db, appointment, _previous_status, "cancelled")  # завдаток - назад клієнту
    await db.commit()
    await _notify_team(db, background_tasks, appointment, "Клієнт скасував запис",
                       [("Коли", appointment.start_time.strftime('%d.%m.%Y, %H:%M'), True)])
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
    background_tasks: BackgroundTasks,
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
    await assert_can_modify_appointment(db, current_user, appointment)

    previous_status = appointment.status
    _old_status = appointment.status
    appointment.status = payload.status
    # Бонуси BookEra: нарахувати за завершений візит або повернути,
    # якщо позначку «завершено» зняли.
    from app.services.bonuses import sync_visit_bonus
    await sync_visit_bonus(db, appointment, _old_status)

    # Комісія й матеріали - одна функція для всіх шляхів завершення
    from app.services.visit_hooks import on_status_change
    await on_status_change(db, appointment, previous_status, payload.status)

    # Цим маршрутом статус змінює КАЛЕНДАР кабінету - тож тут те саме, що
    # в /crm/appointments/{id}: журнал дій і миттєвий «Як вам візит?».
    new_status = str(getattr(payload.status, "value", payload.status))
    if _old_status != new_status:
        from app.services.audit import record as _audit
        _labels = {"completed": "завершено", "no-show": "не прийшов", "confirmed": "підтверджено",
                   "cancelled": "скасовано", "late": "запізнення", "pending_approval": "очікує підтвердження"}
        await _audit(db, appointment.business_id, str(current_user.id), "bookings", "status_changed",
                     f"Запис {appointment.client_name or ''} {appointment.start_time:%d.%m %H:%M}: {_labels.get(new_status, new_status)}")
    from app.services.reminders import request_review_now
    _review_args = await request_review_now(db, appointment) if new_status == "completed" and _old_status != "completed" else None
    await db.commit()
    if _review_args:
        from app.core.email import send_review_request
        background_tasks.add_task(send_review_request, *_review_args)
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

    from app.services.review_rules import review_block_reason, team_identities
    team_cache: dict = {}
    for appointment in appointments:
        response = MyAppointmentResponse.model_validate(appointment, from_attributes=True)
        response.manage_token = appointment.manage_token
        response.has_review = appointment.id in reviewed
        # Чи сторінка салону має пропонувати оцінку: лише завершений, ще не оцінений
        # візит, який сервер справді прийме (review_rules). Для решти - тиша.
        if appointment.status == "completed" and appointment.id not in reviewed and appointment.manage_token:
            if appointment.business_id not in team_cache:
                team_cache[appointment.business_id] = await team_identities(db, appointment.business_id)
            response.can_review = (await review_block_reason(db, appointment, team_cache[appointment.business_id])) is None

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
    # Окремо майстер і заклад. rating - для старих клієнтів (одна оцінка
    # на все): тоді вона стає обома.
    master_rating: Optional[int] = None
    salon_rating: Optional[int] = None
    rating: Optional[int] = None
    comment: Optional[str] = None


@router.post("/{appointment_id}/review")
async def create_review_by_client(
    appointment_id: int,
    payload: ClientReviewRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _rl=Depends(rate_limit("manage", max_requests=60, window_seconds=600))
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

    master_r = payload.master_rating or payload.rating
    salon_r = payload.salon_rating or payload.rating
    for v in (master_r, salon_r):
        if v is not None and not 1 <= v <= 5:
            raise HTTPException(status_code=400, detail="Оцінка має бути від 1 до 5")
    if salon_r is None:
        raise HTTPException(status_code=400, detail="Оцініть заклад")

    comment = (payload.comment or "").strip()[:1000] or None

    res = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = res.scalars().first()
    if not appointment or not appointment.manage_token or not tokens_equal(appointment.manage_token, payload.token):
        raise HTTPException(status_code=404, detail="Візит не знайдено")

    if appointment.status != "completed":
        raise HTTPException(status_code=409, detail="Відгук можна залишити лише після візиту")

    existing = await db.execute(select(Review).where(Review.appointment_id == appointment.id))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Ви вже оцінили цей візит")

    from app.services.review_rules import review_block_reason
    blocked = await review_block_reason(db, appointment)
    if blocked:
        raise HTTPException(status_code=403, detail=blocked)

    if appointment.master_id and master_r is None:
        raise HTTPException(status_code=400, detail="Оцініть майстра")
    if not appointment.master_id:
        master_r = None
    # Загальна - середня з двох, для списків відгуків
    overall = round((master_r + salon_r) / 2) if master_r else salon_r

    db.add(Review(
        business_id=appointment.business_id,
        appointment_id=appointment.id,
        author_name=appointment.client_name,
        rating=overall,
        master_rating=master_r,
        salon_rating=salon_r,
        comment=comment,
    ))
    await db.flush()

    # Рейтинг - середнє всіх відгуків закладу, з одним знаком.
    stats = await db.execute(
        select(func.avg(func.coalesce(Review.salon_rating, Review.rating)), func.count(Review.id)).where(Review.business_id == appointment.business_id)
    )
    avg, count = stats.one()
    biz = await db.get(Business, appointment.business_id)
    if biz:
        biz.rating = round(float(avg), 1) if avg is not None else None
        biz.reviews_count = int(count)

    await db.commit()

    # Низька оцінка (1-3) - одразу власнику й адміністраторам: поки клієнт
    # ще памʼятає візит, ситуацію можна виправити дзвінком. Чайові в
    # такому разі інтерфейс не пропонує.
    if min(r for r in (master_r, salon_r) if r) <= 3:
        await _alert_low_rating(db, background_tasks, appointment, master_r, salon_r, comment)
    return {"ok": True, "rating": biz.rating if biz else None, "reviews_count": biz.reviews_count if biz else None}



async def _recount_business_rating(db: AsyncSession, business_id: int) -> None:
    """Рейтинг закладу - середнє оцінок ЗАКЛАДУ (старі відгуки - загальна)."""
    from app.models.extras import Review
    avg, count = (await db.execute(
        select(func.avg(func.coalesce(Review.salon_rating, Review.rating)), func.count(Review.id))
        .where(Review.business_id == business_id)
    )).one()
    biz = await db.get(Business, business_id)
    if biz:
        biz.rating = round(float(avg), 1) if avg is not None else None
        biz.reviews_count = int(count)


@router.delete("/{appointment_id}/review", status_code=204)
async def delete_review_by_client(
    appointment_id: int,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _rl=Depends(rate_limit("manage", max_requests=60, window_seconds=600))
):
    """
    Клієнт видаляє СВІЙ відгук - за токеном свого візиту, як і залишав.
    Рейтинг закладу перераховується; оцінку можна поставити знову.
    Чужий відгук так не видалити: без токена того візиту - 404.
    """
    from app.models.extras import Review
    a = await db.get(Appointment, appointment_id)
    if not a or not a.manage_token or not tokens_equal(a.manage_token, token):
        raise HTTPException(status_code=404, detail="Відгук не знайдено")
    review = (await db.execute(select(Review).where(Review.appointment_id == a.id))).scalars().first()
    if not review:
        raise HTTPException(status_code=404, detail="Відгук не знайдено")
    await db.delete(review)
    await db.flush()
    await _recount_business_rating(db, a.business_id)
    from app.services.audit import record as _audit
    await _audit(db, a.business_id, None, "bookings", "review_deleted",
                 f"Клієнт {a.client_name or ''} видалив свій відгук про візит {a.start_time:%d.%m}")
    await db.commit()


async def _alert_low_rating(db: AsyncSession, background_tasks: BackgroundTasks, appointment, master_r, salon_r, comment) -> None:
    from app.core.email import send_staff_notice
    from app.models import StaffMembership
    biz = await db.get(Business, appointment.business_id)
    if not biz:
        return
    srv = await db.get(Service, appointment.service_id) if appointment.service_id else None
    master = (await db.execute(select(User).where(User.id == str(appointment.master_id)))).scalars().first() if appointment.master_id else None
    to = set()
    if biz.email:
        to.add(biz.email.lower())
    elif biz.owner_id:
        owner = (await db.execute(select(User).where(User.id == str(biz.owner_id)))).scalars().first()
        if owner and owner.email:
            to.add(owner.email.lower())
    admins = (await db.execute(select(User.email).join(StaffMembership, StaffMembership.user_id == User.id).where(
        StaffMembership.business_id == biz.id, StaffMembership.role == "admin", StaffMembership.is_active.is_(True),
        User.email.isnot(None)))).scalars().all()
    to.update(e.lower() for e in admins)
    stars = lambda n: "★" * n + "☆" * (5 - n)
    rows = [("Заклад", stars(salon_r), True)]
    if master_r:
        rows.append(("Майстер", stars(master_r), True))
    rows += [
            ("Клієнт", f"{appointment.client_name or 'Клієнт'}{' · ' + appointment.client_phone if appointment.client_phone else ''}", False),
            ("Візит", f"{srv.name if srv else 'Візит'} · {appointment.start_time:%d.%m, %H:%M}", False)]
    if master:
        rows.append(("Хто працював", master.full_name or master.email or "", False))
    if comment:
        rows.append(("Коментар", comment, False))
    for email in to:
        background_tasks.add_task(send_staff_notice, email, biz.name, "Низька оцінка візиту", rows,
                                  "Зателефонуйте клієнтові, поки він памʼятає візит, - це часто повертає людину.")


class ClientRescheduleRequest(BaseModel):
    token: str
    start_time: datetime


@router.post("/{appointment_id}/reschedule", response_model=AppointmentResponse)
async def reschedule_appointment_by_client(
    appointment_id: int,
    payload: ClientRescheduleRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _rl=Depends(rate_limit("manage", max_requests=60, window_seconds=600))
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
    if not appointment or not appointment.manage_token or not tokens_equal(appointment.manage_token, payload.token):
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

    old_start = appointment.start_time
    appointment.start_time = new_start
    appointment.end_time = new_start + timedelta(minutes=minutes)
    await db.commit()
    await _notify_team(db, background_tasks, appointment, "Клієнт переніс запис", [
        ("Було", old_start.strftime("%d.%m.%Y, %H:%M"), False),
        ("Тепер", new_start.strftime("%d.%m.%Y, %H:%M"), True),
    ])
    await db.refresh(appointment)
    return appointment
