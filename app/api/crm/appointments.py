from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.appointments import normalize_master_id
from app.core.auth import CurrentUser, assert_business_access, get_current_user
from app.core.time_utils import utc_now
from app.models import Appointment, Business, Client, Service
from app.schemas.appointment import AppointmentResponse, AppointmentRescheduleRequest, ManualAppointmentCreate
from app.services.monetization import award_points_for_new_client

router = APIRouter(prefix="/crm/appointments", tags=["CRM - Appointments"])


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_appointment(
    payload: ManualAppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Запис, який staff вносить вручну (клієнт подзвонив або прийшов з вулиці),
    АБО блокування часу (is_block=true - обід, особиста справа, без клієнта) -
    на відміну від публічного POST /appointments, тут відомо ХТО саме створив
    запис (created_by_staff_id), і не потрібен проміжний lock/confirm.
    """
    await assert_business_access(db, current_user, payload.business_id)

    biz_res = await db.execute(select(Business).where(Business.id == payload.business_id))
    business = biz_res.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    service = None
    duration_minutes = payload.duration_minutes
    price = None

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
        price = service.price
    elif not duration_minutes:
        raise HTTPException(status_code=400, detail="Потрібна тривалість (duration_minutes) для блокування часу")

    client_id = payload.client_id
    if payload.is_block:
        pass  # блокування часу не прив'язане до клієнта
    elif client_id is not None:
        client_res = await db.execute(
            select(Client).where(Client.id == client_id, Client.business_id == payload.business_id)
        )
        if not client_res.scalars().first():
            raise HTTPException(status_code=404, detail="Клієнта не знайдено в цьому закладі")
    elif payload.client_phone:
        # Автоматично підтягуємо існуючий контакт за телефоном, або
        # створюємо новий - щоб ручні записи одразу поповнювали базу клієнтів,
        # а не губились у безликих текстових полях.
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

    appointment = Appointment(
        business_id=payload.business_id,
        service_id=service.id if service else None,
        client_id=client_id,
        master_id=normalize_master_id(payload.master_id),
        created_by_staff_id=current_user.id,
        start_time=payload.start_time,
        end_time=payload.start_time + timedelta(minutes=duration_minutes or 60),
        status="confirmed",
        source="manual",
        price=price,
        client_name="Неробочий час" if payload.is_block else payload.client_name,
        client_phone=payload.client_phone,
        client_email=payload.client_email,
        notes=payload.notes,
        created_at=utc_now(),
    )
    db.add(appointment)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Цей час уже зайнятий іншим записом.")

    await db.refresh(appointment)
    return appointment


@router.patch("/{appointment_id}/reschedule", response_model=AppointmentResponse)
async def reschedule_appointment(
    appointment_id: int,
    payload: AppointmentRescheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Перенесення запису на інший час (напр. перетягування в календарі) -
    тривалість зберігається, зсувається лише початок/кінець."""
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Запис не знайдено")
    await assert_business_access(db, current_user, appointment.business_id)

    duration = appointment.end_time - appointment.start_time
    appointment.start_time = payload.start_time
    appointment.end_time = payload.start_time + duration

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Цей час уже зайнятий іншим записом.")

    await db.refresh(appointment)
    return appointment
