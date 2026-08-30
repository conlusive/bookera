from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, get_current_user
from app.models import Business, Service, ServiceAddon
from app.schemas import ServiceCreate, ServiceResponse, ServiceUpdate

router = APIRouter(prefix="/services", tags=["Services"])


async def _sync_addons(db: AsyncSession, service: Service, addon_ids: List[int]) -> None:
    """Перезаписує зв'язки service_addons під новий список id."""
    existing = await db.execute(select(ServiceAddon).where(ServiceAddon.service_id == service.id))
    for row in existing.scalars().all():
        await db.delete(row)
    for addon_id in set(addon_ids or []):
        if addon_id == service.id:
            continue  # послуга не може бути допослугою сама для себе
        db.add(ServiceAddon(service_id=service.id, addon_service_id=addon_id))


async def _load_with_addons(db: AsyncSession, service_id: int) -> Service:
    result = await db.execute(
        select(Service).where(Service.id == service_id).options(selectinload(Service.addons))
    )
    return result.scalars().first()


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    service_in: ServiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    business_result = await db.execute(select(Business).where(Business.id == service_in.business_id))
    if not business_result.scalars().first():
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    # business_id приходить у тілі запиту, тому перевірка доступу - вручну
    # (не через FastAPI-залежність, яка читає його лише з query/path).
    await assert_business_access(db, current_user, service_in.business_id)

    new_service = Service(
        business_id=service_in.business_id,
        name=service_in.name,
        duration_minutes=service_in.duration_minutes,
        price=service_in.price,
        is_group=service_in.is_group,
        max_participants=service_in.max_participants,
    )
    db.add(new_service)
    await db.flush()

    if service_in.addon_service_ids:
        await _sync_addons(db, new_service, service_in.addon_service_ids)

    await db.commit()
    return await _load_with_addons(db, new_service.id)


@router.get("/business/{business_id}", response_model=List[ServiceResponse])
async def get_business_services(business_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Service).where(Service.business_id == business_id).options(selectinload(Service.addons))
    )
    return result.scalars().all()


@router.patch("/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: int,
    payload: ServiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    service = await _load_with_addons(db, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")
    await assert_business_access(db, current_user, service.business_id)

    data = payload.model_dump(exclude_unset=True, exclude={"addon_service_ids"})
    for field, value in data.items():
        setattr(service, field, value)

    if payload.addon_service_ids is not None:
        await _sync_addons(db, service, payload.addon_service_ids)

    await db.commit()
    return await _load_with_addons(db, service_id)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalars().first()
    if not service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")
    await assert_business_access(db, current_user, service.business_id)
    await db.delete(service)
    await db.commit()
