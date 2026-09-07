"""
Адміністрування платформи: керування підписками закладів.

Окремий роутер, а не частина CRM: тут інший рівень доступу. Плутати
«власник салону» і «власник сервісу» в одному файлі - вірний спосіб
одного дня видати першому права другого.
"""
from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, get_current_user
from app.core.logging_config import logger
from app.core.time_utils import utc_now
from app.models import Business, User
from app.services.subscription import (
    PLAN_FREE,
    PLAN_PRO,
    assert_platform_admin,
    is_subscription_active,
)

router = APIRouter(prefix="/platform", tags=["Platform Admin"])


async def _require_admin(db: AsyncSession, current_user: CurrentUser) -> User:
    res = await db.execute(select(User).where(User.id == str(current_user.id)))
    user = res.scalars().first()
    assert_platform_admin(user)
    return user


class BusinessAdminOut(BaseModel):
    id: int
    name: str
    slug: str
    city: Optional[str] = None
    owner_id: Optional[str] = None
    subscription_plan: str
    subscription_until: Optional[object] = None
    subscription_note: Optional[str] = None
    is_subscription_active: bool

    model_config = ConfigDict(from_attributes=True)


class GrantSubscriptionRequest(BaseModel):
    plan: str = Field(PLAN_PRO, description="'pro' або 'free'")
    # Днів доступу. None означає безстроково - для партнерів і тестування.
    days: Optional[int] = Field(None, ge=1, le=3650)
    note: Optional[str] = Field(None, max_length=300, description="Чому видано")


@router.get("/me")
async def platform_admin_check(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Чи є поточний користувач адміністратором платформи.

    Потрібне інтерфейсу, щоб знати, чи показувати адмін-розділ. Свідомо
    НЕ кидає 403: питання «чи я адміністратор» має мати спокійну
    відповідь «ні», а не помилку.
    """
    res = await db.execute(select(User).where(User.id == str(current_user.id)))
    user = res.scalars().first()
    return {"is_platform_admin": bool(user and user.is_platform_admin)}


@router.get("/businesses", response_model=List[BusinessAdminOut])
async def list_all_businesses(
    search: Optional[str] = Query(None, description="Пошук за назвою або містом"),
    plan: Optional[str] = Query(None, description="Фільтр за тарифом"),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Усі заклади платформи - для пошуку того, кому видати підписку."""
    await _require_admin(db, current_user)

    stmt = select(Business)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(or_(Business.name.ilike(pattern), Business.city.ilike(pattern)))
    if plan:
        stmt = stmt.where(Business.subscription_plan == plan)

    result = await db.execute(stmt.order_by(Business.created_at.desc()).limit(limit))
    businesses = result.scalars().all()

    return [
        BusinessAdminOut(
            id=b.id, name=b.name, slug=b.slug, city=b.city, owner_id=b.owner_id,
            subscription_plan=b.subscription_plan,
            subscription_until=b.subscription_until,
            subscription_note=b.subscription_note,
            is_subscription_active=is_subscription_active(b),
        )
        for b in businesses
    ]


@router.post("/businesses/{business_id}/subscription", response_model=BusinessAdminOut)
async def grant_subscription(
    business_id: int,
    payload: GrantSubscriptionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Видати або зняти підписку вручну.

    Потрібно для партнерів, тестових доступів і випадків, коли оплата
    пройшла повз систему (готівкою, переказом). Без цього єдиним шляхом
    лишалась би правка бази напряму.

    Кожна дія пишеться в лог із іменем адміністратора: ручна видача
    платного доступу - саме та операція, про яку через півроку
    доведеться згадувати, хто і навіщо її зробив.
    """
    admin = await _require_admin(db, current_user)

    if payload.plan not in (PLAN_FREE, PLAN_PRO):
        raise HTTPException(status_code=400, detail="Невідомий тариф")

    res = await db.execute(select(Business).where(Business.id == business_id))
    business = res.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    business.subscription_plan = payload.plan
    if payload.plan == PLAN_FREE:
        # Знімаючи підписку, чистимо і дату: інакше в базі лишається
        # «free до 2027 року», що читається як діючий доступ.
        business.subscription_until = None
        business.subscription_note = payload.note
    else:
        business.subscription_until = (
            utc_now() + timedelta(days=payload.days) if payload.days else None
        )
        business.subscription_note = payload.note

    await db.commit()
    await db.refresh(business)

    logger.info(
        "Підписку змінено: business_id=%s plan=%s until=%s admin=%s note=%s",
        business.id, business.subscription_plan, business.subscription_until,
        admin.email or admin.id, payload.note or "-",
    )

    return BusinessAdminOut(
        id=business.id, name=business.name, slug=business.slug, city=business.city,
        owner_id=business.owner_id,
        subscription_plan=business.subscription_plan,
        subscription_until=business.subscription_until,
        subscription_note=business.subscription_note,
        is_subscription_active=is_subscription_active(business),
    )


@router.get("/stats")
async def platform_stats(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Загальна картина: скільки закладів і скільки з них платять."""
    from sqlalchemy import func

    await _require_admin(db, current_user)

    total = await db.execute(select(func.count(Business.id)))
    pro = await db.execute(
        select(func.count(Business.id)).where(Business.subscription_plan == PLAN_PRO)
    )
    result = await db.execute(select(Business).where(Business.subscription_plan == PLAN_PRO))

    # Рахуємо ДІЙСНІ підписки окремо: заклад може мати план 'pro'
    # із простроченою датою, і в звіті це не платний клієнт.
    active = sum(1 for b in result.scalars().all() if is_subscription_active(b))

    return {
        "total_businesses": total.scalar() or 0,
        "pro_plan": pro.scalar() or 0,
        "pro_active": active,
    }
