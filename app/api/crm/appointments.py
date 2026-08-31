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
from app.schemas.appointment import AppointmentResponse, ManualAppointmentCreate

router = APIRouter(prefix="/crm/appointments", tags=["CRM - Appointments"])


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_appointment(
    payload: ManualAppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Запис, який staff вносить вручну (клієнт подзвонив або прийшов з вулиці) -
    на відміну від публічного POST /appointments, тут відомо ХТО саме створив
    запис (created_by_staff_id), і не потрібен проміжний lock/confirm - власник
    чи майстер бізнесу може одразу підтверджувати запис від свого імені.
    """
    await assert_business_access(db, current_user, payload.business_id)

    biz_res = await db.execute(select(Business).where(Business.id == payload.business_id))
    business = biz_res.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    srv_res = await db.execute(
        select(Service).where(Service.id == payload.service_id, Service.business_id == payload.business_id)
    )
    service = srv_res.scalars().first()
    if not service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")

    client_id = payload.client_id
    if client_id is not None:
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
        client_id = client.id

    appointment = Appointment(
        business_id=payload.business_id,
        service_id=payload.service_id,
        client_id=client_id,
        master_id=normalize_master_id(payload.master_id),
        created_by_staff_id=current_user.id,
        start_time=payload.start_time,
        end_time=payload.start_time + timedelta(minutes=service.duration_minutes or 60),
        status="confirmed",
        source="manual",
        price=service.price,
        client_name=payload.client_name,
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
