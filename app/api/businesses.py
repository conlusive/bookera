from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db
from app.models.base import Business, User
from app.schemas.business import BusinessCreate, BusinessResponse
from app.models.base import Service
from app.schemas.service import ServiceCreate, ServiceResponse

router = APIRouter(tags=["Businesses"])


# 1. ТЕПЕР МАРШРУТ - "/all". Це точно має бути зверху!
@router.get("/all", response_model=List[BusinessResponse])
async def get_all_businesses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Business))
    return result.scalars().all()


# 2. ДИНАМІЧНИЙ маршрут - ВСЕ ЩЕ знизу!
@router.get("/{slug}", response_model=BusinessResponse)
async def get_business(slug: str, db: AsyncSession = Depends(get_db)):
    # Додамо захист: якщо хтось випадково намагається стукати сюди,
    # а це не slug — ігноруємо.
    result = await db.execute(select(Business).where(Business.slug == slug))
    business = result.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Салон не знайдено")
    return business


# 3. ПОСТ (не конфліктує, бо метод інший)
@router.post("", response_model=BusinessResponse)
async def create_business(business_in: BusinessCreate, db: AsyncSession = Depends(get_db)):
    user_result = await db.execute(select(User).where(User.id == business_in.owner_id))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")

    slug_result = await db.execute(select(Business).where(Business.slug == business_in.slug))
    if slug_result.scalars().first():
        raise HTTPException(status_code=400, detail="Цей URL (slug) вже зайнятий")

    new_business = Business(
        owner_id=business_in.owner_id,
        name=business_in.name,
        slug=business_in.slug,
        address=business_in.address
    )

    db.add(new_business)
    await db.commit()
    await db.refresh(new_business)
    return new_business


# 4. Створення послуги для салону
@router.post("/services", response_model=ServiceResponse, tags=["Services"])
async def create_service(service_in: ServiceCreate, db: AsyncSession = Depends(get_db)):
    # Перевіряємо, чи існує такий салон
    business_result = await db.execute(select(Business).where(Business.id == service_in.business_id))
    if not business_result.scalars().first():
        raise HTTPException(status_code=404, detail="Салон не знайдено")

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


# 5. Отримання всіх послуг конкретного салону
@router.get("/{business_id}/services", response_model=List[ServiceResponse], tags=["Services"])
async def get_business_services(business_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Service).where(Service.business_id == business_id))
    return result.scalars().all()


# 6. ОНОВЛЕННЯ (РЕДАГУВАННЯ) ПОСЛУГИ ЗА ID
@router.put("/services/{service_id}", response_model=ServiceResponse, tags=["Services"])
async def update_service(service_id: int, service_in: ServiceCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Service).where(Service.id == service_id))
    db_service = result.scalars().first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")

    # Оновлюємо поля моделі новими даними з форми
    db_service.name = service_in.name
    db_service.duration_minutes = service_in.duration_minutes
    db_service.price = service_in.price
    db_service.business_id = service_in.business_id

    await db.commit()
    await db.refresh(db_service)
    return db_service


# 7. ВИДАЛЕННЯ ПОСЛУГ ЗА ID
@router.delete("/services/{service_id}", tags=["Services"])
async def delete_service(service_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Service).where(Service.id == service_id))
    db_service = result.scalars().first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")

    await db.delete(db_service)
    await db.commit()
    return {"detail": "Послугу успішно видалено з бази даних"}

@router.put("/{business_id}", response_model=BusinessResponse)
async def update_business_profile(business_id: int, business_in: BusinessCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Business).where(Business.id == business_id))
    db_business = result.scalars().first()
    if not db_business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    db_business.name = business_in.name
    db_business.address = business_in.address
    db_business.slug = business_in.slug
    db_business.owner_id = business_in.owner_id

    await db.commit()
    await db.refresh(db_business)
    return db_business