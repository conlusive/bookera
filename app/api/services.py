from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db
from app.models.user import Service, Business
from app.schemas import ServiceCreate, ServiceResponse, ServiceUpdate

router = APIRouter(prefix="/services", tags=["Services"])


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    service_in: ServiceCreate, db: AsyncSession = Depends(get_db)
):
    business_result = await db.execute(
        select(Business).where(Business.id == service_in.business_id)
    )
    if not business_result.scalars().first():
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    new_service = Service(
        business_id=service_in.business_id,
        name=service_in.name,
        duration_minutes=service_in.duration_minutes,
        price=service_in.price,
        is_group=service_in.is_group,
        max_participants=service_in.max_participants,
        addon_service_ids=service_in.addon_service_ids or [],
    )

    db.add(new_service)
    await db.commit()
    await db.refresh(new_service)

    return new_service


@router.get("/business/{business_id}", response_model=List[ServiceResponse])
async def get_business_services(
    business_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Service).where(Service.business_id == business_id)
    )
    return result.scalars().all()