import os
import secrets
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.appointments import normalize_master_id
from app.core.auth import CurrentUser, assert_business_access, get_current_user
from app.core.time_utils import utc_now
from app.models import Appointment, Business, Client, Service, User
from app.schemas.appointment import AppointmentResponse, AppointmentRescheduleRequest, ManualAppointmentCreate
from app.core.email import send_booking_rescheduled_email
from app.services.monetization import award_points_for_new_client

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

router = APIRouter(prefix="/crm/appointments", tags=["CRM - Appointments"])


class StatusUpdatePayload(BaseModel):
    status: str


def to_naive_utc(dt: datetime | None) -> datetime | None:
    """Перетворює datetime на offset-naive UTC для коректного збереження в TIMESTAMP WITHOUT TIME ZONE (asyncpg)."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def clean_master_id(val) -> str | None:
    """Очищує master_id від службових нулів і рядків 'all'/'none' для перерви всього закладу."""
    if val in (None, "", "0", 0, "all", "none", "undefined"):
        return None
    try:
        norm = normalize_master_id(val)
        if norm in (None, "", "0", 0, "all", "none", "undefined"):
            return None
        return str(norm)
    except Exception:
        return str(val)


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_appointment(
    payload: ManualAppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Запис, який staff вносить вручну (клієнт подзвонив або прийшов з вулиці),
    АБО блокування часу (is_block=true - обід, перерва майстра або всього закладу).
    """
    await assert_business_access(db, current_user, payload.business_id)

    biz_res = await db.execute(select(Business).where(Business.id == payload.business_id))
    business = biz_res.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    service = None
    duration_minutes = payload.duration_minutes
    price = Decimal("0")

    if not payload.is_block:
        if not payload.service_id:
            raise HTTPException(status_code=400, detail="Потрібна послуга, якщо це не блокування часу")
        srv_res = await db.execute(
            select(Service).where(Service.id == payload.service_id, Service.business_id == payload.business_id)
        )
        service = srv_res.scalars().first()
        if not service:
            raise HTTPException(status_code=404, detail="Послугу не знайдено")
        duration_minutes = service.duration_minutes
        price = Decimal(str(service.price or 0))
    else:
        duration_minutes = duration_minutes or 60

    client_id = payload.client_id
    if payload.is_block:
        client_id = None
    elif client_id is not None:
        client_res = await db.execute(
            select(Client).where(Client.id == client_id, Client.business_id == payload.business_id)
        )
        if not client_res.scalars().first():
            raise HTTPException(status_code=404, detail="Клієнта не знайдено в цьому закладі")
    elif payload.client_phone:
        existing = await db.execute(
            select(Client).where(Client.business_id == payload.business_id, Client.phone == payload.client_phone)
        )
        client = existing.scalars().first()
        if not client:
            client = Client(
                business_id=payload.business_id,
                name=payload.client_name or payload.client_phone,
                phone=payload.client_phone,
                email=payload.client_email,
            )
            db.add(client)
            await db.flush()
            await award_points_for_new_client(db, business, payload.client_phone, client.id)
        client_id = client.id

    # Додаткові послуги
    addon_ids: list[int] = []
    addon_minutes = 0
    addon_price = Decimal("0")

    if not payload.is_block and payload.addon_service_ids and service:
        addons_res = await db.execute(
            select(Service).where(
                Service.id.in_([int(i) for i in payload.addon_service_ids]),
                Service.business_id == payload.business_id,
            )
        )
        for addon in addons_res.scalars().all():
            addon_ids.append(addon.id)
            addon_minutes += addon.duration_minutes or 0
            addon_price += Decimal(str(addon.price or 0))

    total_minutes = (duration_minutes or 60) + addon_minutes
    if addon_price:
        price += addon_price

    # Формування даних перерви або запису
    block_title = (payload.notes or payload.client_name or "Перерва").strip()
    status_val = "blocked" if payload.is_block else "confirmed"
    target_master_id = clean_master_id(payload.master_id)

    clean_start = to_naive_utc(payload.start_time)
    clean_end = clean_start + timedelta(minutes=total_minutes)

    appointment = Appointment(
        business_id=payload.business_id,
        service_id=service.id if service else None,
        addon_service_ids=addon_ids or None,
        client_id=client_id,
        master_id=target_master_id,
        created_by_staff_id=current_user.id,
        start_time=clean_start,
        end_time=clean_end,
        status=status_val,
        source="manual",
        price=price,
        client_name=block_title if payload.is_block else (payload.client_name or "Клієнт"),
        client_phone=payload.client_phone if not payload.is_block else None,
        client_email=payload.client_email if not payload.is_block else None,
        notes=block_title if payload.is_block else payload.notes,
        created_at=to_naive_utc(utc_now()),
    )
    db.add(appointment)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        err_msg = str(e.orig).lower() if hasattr(e, "orig") else str(e).lower()

        if "conflict" in err_msg or "overlap" in err_msg or "exclude" in err_msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Цей час уже зайнятий іншим записом.")

        # Резервна обробка для старих схем баз даних
        if payload.is_block:
            fallback_service_id = None
            if "service_id" in err_msg and "null" in err_msg:
                fallback_srv = (await db.execute(
                    select(Service).where(Service.business_id == payload.business_id).limit(1)
                )).scalars().first()
                if fallback_srv:
                    fallback_service_id = fallback_srv.id

            safe_status = "confirmed" if ("status" in err_msg or "check" in err_msg) else "blocked"
            safe_master_id = current_user.id if ("master_id" in err_msg and "null" in err_msg) else target_master_id

            retry_appointment = Appointment(
                business_id=payload.business_id,
                service_id=fallback_service_id,
                addon_service_ids=None,
                client_id=None,
                master_id=safe_master_id,
                created_by_staff_id=current_user.id,
                start_time=clean_start,
                end_time=clean_end,
                status=safe_status,
                source="manual",
                price=Decimal("0"),
                client_name=block_title,
                client_phone=None,
                client_email=None,
                notes=block_title,
                created_at=to_naive_utc(utc_now()),
            )
            db.add(retry_appointment)
            try:
                await db.commit()
                appointment = retry_appointment
            except Exception:
                await db.rollback()
                raise HTTPException(status_code=400, detail="Не вдалося заблокувати час через обмеження бази даних.")
        else:
            raise HTTPException(status_code=400, detail="Помилка збереження запису в базі даних.")

    await db.refresh(appointment)

    # Прикріплюємо UTC для однозначної серіалізації в JSON (з 'Z')
    if appointment.start_time and appointment.start_time.tzinfo is None:
        appointment.start_time = appointment.start_time.replace(tzinfo=timezone.utc)
    if appointment.end_time and appointment.end_time.tzinfo is None:
        appointment.end_time = appointment.end_time.replace(tzinfo=timezone.utc)

    return appointment


@router.patch("/{appointment_id}/status", response_model=AppointmentResponse)
@router.patch("/{appointment_id}", response_model=AppointmentResponse)
async def update_crm_appointment_status(
    appointment_id: int,
    payload: StatusUpdatePayload,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Оновлення статусу запису (confirmed, completed, late, no-show, cancelled, blocked)."""
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Запис не знайдено")
    await assert_business_access(db, current_user, appointment.business_id)

    new_status = payload.status.lower().strip()

    # Якщо скасовують перерву — повністю видаляємо її, звільняючи слот
    is_block = appointment.status == "blocked" or (appointment.notes and "перерва" in appointment.notes.lower())
    if new_status == "cancelled" and is_block:
        await db.delete(appointment)
        await db.commit()
        appointment.status = "cancelled"
        return appointment

    appointment.status = new_status
    appointment.updated_at = to_naive_utc(utc_now())

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Не вдалося оновити статус: {str(e)}")

    await db.refresh(appointment)

    if appointment.start_time and appointment.start_time.tzinfo is None:
        appointment.start_time = appointment.start_time.replace(tzinfo=timezone.utc)
    if appointment.end_time and appointment.end_time.tzinfo is None:
        appointment.end_time = appointment.end_time.replace(tzinfo=timezone.utc)

    return appointment


@router.delete("/{appointment_id}", status_code=status.HTTP_200_OK)
async def delete_crm_appointment(
    appointment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Повне видалення запису або перерви з бази даних."""
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Запис не знайдено")
    await assert_business_access(db, current_user, appointment.business_id)

    await db.delete(appointment)
    await db.commit()
    return {"ok": True, "id": appointment_id}


@router.patch("/{appointment_id}/reschedule", response_model=AppointmentResponse)
async def reschedule_appointment(
    appointment_id: int,
    payload: AppointmentRescheduleRequest,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Перенесення запису на інший час (drag-and-drop у календарі)."""
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Запис не знайдено")
    await assert_business_access(db, current_user, appointment.business_id)

    old_start = appointment.start_time
    duration = (appointment.end_time - appointment.start_time) if appointment.end_time else timedelta(minutes=60)

    new_start = to_naive_utc(payload.start_time)
    appointment.start_time = new_start
    appointment.end_time = new_start + duration

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Цей час уже зайнятий іншим записом.")

    await db.refresh(appointment)

    # Сповіщення клієнта надсилаємо лише для реальних клієнтських записів
    is_blocked_visit = appointment.status == "blocked" or (appointment.notes and "перерва" in appointment.notes.lower())
    if appointment.client_email and not is_blocked_visit and background_tasks is not None:
        biz_res = await db.execute(select(Business).where(Business.id == appointment.business_id))
        business = biz_res.scalars().first()
        service = None
        if appointment.service_id:
            srv_res = await db.execute(select(Service).where(Service.id == appointment.service_id))
            service = srv_res.scalars().first()

        if not appointment.manage_token:
            appointment.manage_token = secrets.token_urlsafe(24)
            await db.commit()

        master_display = ""
        if appointment.master_id:
            m_res = await db.execute(select(User).where(User.id == str(appointment.master_id)))
            master = m_res.scalars().first()
            master_display = (master.full_name or "") if master else ""

        background_tasks.add_task(
            send_booking_rescheduled_email,
            to_email=appointment.client_email,
            client_name=appointment.client_name or "Вітаємо",
            business_name=business.name if business else "Заклад",
            service_name=service.name if service else "Візит",
            old_date=old_start.strftime("%d.%m.%Y") if old_start else "",
            old_time=old_start.strftime("%H:%M") if old_start else "",
            new_date=appointment.start_time.strftime("%d.%m.%Y") if appointment.start_time else "",
            new_time=appointment.start_time.strftime("%H:%M") if appointment.start_time else "",
            address=(business.address or "") if business else "",
            manage_url=f"{FRONTEND_URL}/my-booking/{appointment.id}?token={appointment.manage_token}",
            master_name=master_display,
        )

    if appointment.start_time and appointment.start_time.tzinfo is None:
        appointment.start_time = appointment.start_time.replace(tzinfo=timezone.utc)
    if appointment.end_time and appointment.end_time.tzinfo is None:
        appointment.end_time = appointment.end_time.replace(tzinfo=timezone.utc)

    return appointment