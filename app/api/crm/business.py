import re
import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, get_current_user
from app.models import Business, BusinessHours, User
from app.schemas.business import BusinessCreate, BusinessUpdate, BusinessOut, BusinessHoursItem

router = APIRouter(prefix="/crm/businesses", tags=["CRM - Business"])

# ПРИМІТКА: тут навмисно немає DELETE /{business_id}. У моделі Business
# каскадне видалення (services, appointments, clients, invites, reviews,
# inventory, expenses - усе з cascade="all, delete-orphan") означає, що
# фізичне видалення бізнесу назавжди стирає всю історію бронювань і фінансів.
# "Видалення" бізнесу - це PATCH з is_active=false (soft delete), не DELETE.


def slugify(name: str) -> str:
    base = re.sub(r"[^\w\s-]", "", name.lower()).strip()
    base = re.sub(r"[\s_-]+", "-", base)
    return f"{base}-{secrets.token_hex(3)}"


@router.post("", response_model=BusinessOut, status_code=status.HTTP_201_CREATED)
async def register_business(
    payload: BusinessCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Раніше фронтенд сам вставляв owner_id = localStorage.getItem('userId')
    напряму в Supabase - значення, яке будь-хто міг підмінити в DevTools.
    Тепер owner_id береться ВИКЛЮЧНО з перевіреного JWT, сервер не довіряє
    жодному полю "хто я" з тіла запиту.
    """
    data = payload.model_dump(exclude={"hours"})

    # Спершу гарантуємо, що User-запис існує (owner_id має FK на users.id -
    # для першого входу нового власника цього рядка ще нема).
    user_res = await db.execute(select(User).where(User.id == current_user.id))
    user = user_res.scalars().first()
    if not user:
        user = User(id=current_user.id, email=current_user.email or "", role="business_owner")
        db.add(user)
        await db.flush()
    else:
        user.role = "business_owner"

    business = Business(**data, owner_id=current_user.id, slug=slugify(payload.name))
    db.add(business)
    await db.flush()

    user.business_id = business.id

    for h in (payload.hours or []):
        db.add(BusinessHours(business_id=business.id, **h.model_dump()))

    await db.commit()
    # Свіжий запит з явним підвантаженням services (не .refresh() +
    # присвоєння - обидва варіанти тригерять lazy-load поза async-контекстом
    # і падають з MissingGreenlet при серіалізації відповіді).
    result = await db.execute(
        select(Business).where(Business.id == business.id).options(selectinload(Business.services))
    )
    return result.scalars().first()


@router.patch("/{business_id}", response_model=BusinessOut)
async def update_business(
    business_id: int,
    payload: BusinessUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_access(db, current_user, business_id)
    result = await db.execute(select(Business).where(Business.id == business_id))
    business = result.scalars().first()

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(business, field, value)
    await db.commit()

    # Так само явно підвантажуємо services через окремий запит замість
    # lazy-load, щоб уникнути MissingGreenlet при серіалізації відповіді.
    result = await db.execute(
        select(Business).where(Business.id == business_id).options(selectinload(Business.services))
    )
    return result.scalars().first()


@router.put("/{business_id}/hours", response_model=List[BusinessHoursItem])
async def set_business_hours(
    business_id: int,
    hours: List[BusinessHoursItem],
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_access(db, current_user, business_id)

    existing = await db.execute(select(BusinessHours).where(BusinessHours.business_id == business_id))
    by_weekday = {h.weekday: h for h in existing.scalars().all()}

    for item in hours:
        if item.weekday in by_weekday:
            row = by_weekday[item.weekday]
            row.is_open = item.is_open
            row.open_time = item.open_time
            row.close_time = item.close_time
        else:
            db.add(BusinessHours(business_id=business_id, **item.model_dump()))

    await db.commit()
    result = await db.execute(select(BusinessHours).where(BusinessHours.business_id == business_id))
    return result.scalars().all()
