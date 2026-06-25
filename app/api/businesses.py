from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db
from app.models.base import Business, User
from app.schemas.business import BusinessCreate, BusinessResponse

# Створюємо роутер
router = APIRouter(tags=["Businesses"])


# --- СТВОРЕННЯ ---
@router.post("", response_model=BusinessResponse)
async def create_business(business_in: BusinessCreate, db: AsyncSession = Depends(get_db)):
    user_result = await db.execute(select(User).where(User.id == business_in.owner_id))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")

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


# --- ОТРИМАННЯ КОНКРЕТНОГО ---
@router.get("/{slug}", response_model=BusinessResponse)
async def get_business(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Business).where(Business.slug == slug))
    business = result.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Салон не знайдено")
    return business


# --- ОТРИМАННЯ ВСІХ ---
@router.get("", response_model=List[BusinessResponse])
async def get_all_businesses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Business))
    return result.scalars().all()