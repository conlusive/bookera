from typing import List

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, assert_business_admin, get_current_user, assert_section
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
    await assert_section(db, current_user, service_in.business_id, "services")

    # Нова послуга - в КІНЕЦЬ прайсу. Раніше order_index був 0 для всіх
    # нових, і нова послуга ставала першою, штовхаючи налаштований порядок.
    from sqlalchemy import func as _f
    max_order = (await db.execute(select(_f.max(Service.order_index)).where(Service.business_id == service_in.business_id))).scalar()
    new_service = Service(
        order_index=(max_order or 0) + 1,
        business_id=service_in.business_id,
        name=service_in.name,
        duration_minutes=service_in.duration_minutes,
        price=service_in.price,
        is_group=service_in.is_group,
        max_participants=service_in.max_participants,
        description=service_in.description,
        category=service_in.category,
        is_active=service_in.is_active,
    )
    db.add(new_service)
    await db.flush()

    if service_in.addon_service_ids:
        await _sync_addons(db, new_service, service_in.addon_service_ids)

    # Журнал дій

    from app.services.audit import record as _audit

    await _audit(db, new_service.business_id, str(current_user.id), "services", "service_created", f"Додано послугу: {new_service.name}, {new_service.price} ₴")

    await db.commit()
    return await _load_with_addons(db, new_service.id)


@router.get("/business/{business_id}", response_model=List[ServiceResponse])
async def get_business_services(business_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Service).where(Service.business_id == business_id).options(selectinload(Service.addons))
    )
    return result.scalars().all()


class ReorderIn(BaseModel):
    business_id: int
    ids: List[int]


@router.put("/reorder")
async def reorder_services(
    payload: ReorderIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Порядок послуг у прайсі - одним запитом і однією транзакцією.
    Раніше кабінет надсилав окремий запит на КОЖНУ послугу: 20 послуг -
    20 запитів, і обрив посередині лишав порядок наполовину старим.
    """
    await assert_section(db, current_user, payload.business_id, "services")
    rows = (await db.execute(select(Service).where(Service.business_id == payload.business_id))).scalars().all()
    by_id = {s.id: s for s in rows}
    if set(payload.ids) - set(by_id):
        raise HTTPException(status_code=400, detail="У списку є чужі послуги")
    for i, sid in enumerate(payload.ids):
        by_id[sid].order_index = i
    # Послуги, яких немає в списку, - після них, у колишньому порядку
    rest = sorted((s for s in rows if s.id not in set(payload.ids)), key=lambda s: s.order_index or 0)
    for j, s in enumerate(rest, start=len(payload.ids)):
        s.order_index = j
    from app.services.audit import record as _audit
    await _audit(db, payload.business_id, str(current_user.id), "services", "reordered", "Змінено порядок послуг у прайсі")
    await db.commit()
    return {"status": "ok"}


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
    await assert_section(db, current_user, service.business_id, "services")

    data = payload.model_dump(exclude_unset=True, exclude={"addon_service_ids"})
    for field, value in data.items():
        setattr(service, field, value)

    if payload.addon_service_ids is not None:
        await _sync_addons(db, service, payload.addon_service_ids)

    # Журнал дій

    from app.services.audit import record as _audit

    await _audit(db, service.business_id, str(current_user.id), "services", "service_updated", f"Змінено послугу: {service.name}" + (f", ціна {data['price']} ₴" if "price" in data else ""))

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
    await assert_section(db, current_user, service.business_id, "services")
    await db.delete(service)
    # Журнал дій
    from app.services.audit import record as _audit
    await _audit(db, service.business_id, str(current_user.id), "services", "service_deleted", f"Видалено послугу: {service.name}")
    await db.commit()
