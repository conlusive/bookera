from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db
from app.models.base import Business
from app.schemas.business import BusinessCreate, BusinessResponse

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