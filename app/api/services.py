from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db
from app.models.user import Service, Business
from app.schemas.service import ServiceCreate, ServiceResponse
from typing import List

# Створюємо роутер для послуг
router = APIRouter(prefix="/services", tags=["Services"])


@router.post("/", response_model=ServiceResponse)
async def create_service(service_in: ServiceCreate, db: AsyncSession = Depends(get_db)):
    # 1. Перевіряємо, чи існує такий бізнес
    business_result = await db.execute(select(Business).where(Business.id == service_in.business_id))
    if not business_result.scalars().first():
        raise HTTPException(status_code=404, detail="Бізнес не знайдено")

    # 2. Створюємо послугу в базі
    new_service = Service(
        business_id=service_in.business_id,
        name=service_in.name,
        duration_minutes=service_in.duration_minutes,
        price=service_in.price
    )

    db.add(new_service)
    await db.commit()
    await db.refresh(new_service)

    return new_service

@router.get("/business/{business_id}", response_model=List[ServiceResponse])
async def get_business_services(business_id: int, db: AsyncSession = Depends(get_db)):
    # Шукаємо всі послуги, які прив'язані до цього business_id
    result = await db.execute(select(Service).where(Service.business_id == business_id))
    services = result.scalars().all()
    return services