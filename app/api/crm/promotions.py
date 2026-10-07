"""Акції закладу: керування в кабінеті (/crm/promotions) і публічні підказки для запису (/public/...)."""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_section, get_current_user
from app.core.rate_limit import rate_limit
from app.models import Promotion, Service
from app.services import promotions as promo_service
from app.services.audit import record as _audit

router = APIRouter(tags=["Promotions"])

MAX_PROMOTIONS = 20


def _hhmm(v: Optional[str]) -> Optional[str]:
    if v in (None, ""):
        return None
    try:
        h, m = str(v).split(":")[:2]
        h, m = int(h), int(m)
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError
        return f"{h:02d}:{m:02d}"
    except ValueError:
        raise ValueError("Час має бути у форматі ГГ:ХХ")


class PromotionIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    discount_percent: int = Field(..., ge=1, le=90)
    service_ids: Optional[List[int]] = None     # None або порожній - усі послуги
    weekdays: Optional[List[int]] = None        # 0=Пн..6=Нд; None - щодня
    time_from: Optional[str] = None
    time_to: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    is_active: bool = True

    @field_validator("time_from", "time_to", mode="before")
    @classmethod
    def _time(cls, v):
        return _hhmm(v)

    @field_validator("weekdays")
    @classmethod
    def _days(cls, v):
        if v is None:
            return None
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("День тижня - число від 0 (пн) до 6 (нд)")
        return sorted(set(v)) if len(set(v)) < 7 else None

    @model_validator(mode="after")
    def _consistent(self):
        if bool(self.time_from) != bool(self.time_to):
            raise ValueError("Вкажіть і початок, і кінець годин дії акції - або жодного")
        if self.time_from and self.time_from == self.time_to:
            raise ValueError("Початок і кінець годин не можуть збігатись")
        if self.date_from and self.date_to and self.date_to < self.date_from:
            raise ValueError("Кінець акції раніше за початок")
        return self


class PromotionOut(BaseModel):
    id: int
    name: str
    discount_percent: int
    service_ids: Optional[List[int]] = None
    weekdays: Optional[List[int]] = None
    time_from: Optional[str] = None
    time_to: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    is_active: bool
    label: str = ""

    @classmethod
    def of(cls, p: Promotion) -> "PromotionOut":
        return cls(
            id=p.id, name=p.name, discount_percent=p.discount_percent, service_ids=p.service_ids or None,
            weekdays=p.weekdays or None, time_from=p.time_from, time_to=p.time_to, date_from=p.date_from,
            date_to=p.date_to, is_active=p.is_active, label=promo_service.label(p),
        )


async def _check_services(db: AsyncSession, business_id: int, ids: Optional[List[int]]) -> Optional[List[int]]:
    if not ids:
        return None
    found = set((await db.execute(select(Service.id).where(Service.business_id == business_id, Service.id.in_(ids)))).scalars().all())
    if found != set(ids):
        raise HTTPException(status_code=422, detail="Серед обраних послуг є такі, яких немає в цьому закладі")
    return sorted(found)


@router.get("/crm/promotions", response_model=List[PromotionOut])
async def list_promotions(
    business_id: int = Query(...), db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user),
):
    await assert_section(db, current_user, business_id, "analytics")
    try:
        rows = (await db.execute(select(Promotion).where(Promotion.business_id == business_id).order_by(Promotion.id.desc()))).scalars().all()
    except DBAPIError:
        raise HTTPException(status_code=503, detail="Акції ще не підключені: базу даних потрібно оновити (alembic upgrade head)")
    return [PromotionOut.of(p) for p in rows]


@router.post("/crm/promotions", response_model=PromotionOut, status_code=status.HTTP_201_CREATED)
async def create_promotion(
    payload: PromotionIn, business_id: int = Query(...), db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_section(db, current_user, business_id, "analytics")
    count = (await db.execute(select(func.count(Promotion.id)).where(Promotion.business_id == business_id))).scalar() or 0
    if count >= MAX_PROMOTIONS:
        raise HTTPException(status_code=409, detail=f"Не більше {MAX_PROMOTIONS} акцій. Видаліть непотрібні.")
    data = payload.model_dump()
    data["service_ids"] = await _check_services(db, business_id, payload.service_ids)
    promo = Promotion(business_id=business_id, **data)
    db.add(promo)
    await db.flush()
    await _audit(db, business_id, str(current_user.id), "marketing", "promotion_created", f"Акція «{promo.name}»: {promo_service.label(promo)}")
    await db.commit()
    return PromotionOut.of(promo)


async def _owned(db: AsyncSession, current_user: CurrentUser, promo_id: int) -> Promotion:
    promo = (await db.execute(select(Promotion).where(Promotion.id == promo_id))).scalars().first()
    if not promo:
        raise HTTPException(status_code=404, detail="Акцію не знайдено")
    await assert_section(db, current_user, promo.business_id, "analytics")
    return promo


@router.put("/crm/promotions/{promo_id}", response_model=PromotionOut)
async def update_promotion(
    promo_id: int, payload: PromotionIn, db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user),
):
    promo = await _owned(db, current_user, promo_id)
    data = payload.model_dump()
    data["service_ids"] = await _check_services(db, promo.business_id, payload.service_ids)
    for k, v in data.items():
        setattr(promo, k, v)
    await _audit(db, promo.business_id, str(current_user.id), "marketing", "promotion_updated", f"Змінено акцію «{promo.name}»")
    await db.commit()
    return PromotionOut.of(promo)


@router.delete("/crm/promotions/{promo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_promotion(promo_id: int, db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    promo = await _owned(db, current_user, promo_id)
    await _audit(db, promo.business_id, str(current_user.id), "marketing", "promotion_deleted", f"Видалено акцію «{promo.name}»")
    await db.delete(promo)
    await db.commit()


# ---------------------------------------------------------------- публічне

@router.get("/public/promotions", response_model=List[PromotionOut])
async def public_promotions(
    business_id: int = Query(...), db: AsyncSession = Depends(get_db),
    _rl=Depends(rate_limit("promos", max_requests=120, window_seconds=60)),
):
    """Чинні акції закладу - для позначок «−10%» на вітрині й у формі запису."""
    return [PromotionOut.of(p) for p in await promo_service.active_promotions(db, business_id)]


@router.get("/public/quote")
async def quote(
    business_id: int = Query(...), service_id: int = Query(...), start_time: datetime = Query(...),
    addon_service_ids: Optional[str] = Query(None, description="id додаткових послуг через кому"),
    db: AsyncSession = Depends(get_db),
    _rl=Depends(rate_limit("quote", max_requests=120, window_seconds=60)),
):
    """Ціна візиту з урахуванням акції - та сама, що буде в записі."""
    service = (await db.execute(select(Service).where(Service.id == service_id, Service.business_id == business_id))).scalars().first()
    if not service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")
    base = Decimal(str(service.price or 0))
    wanted = [int(x) for x in (addon_service_ids or "").split(",") if x.strip().isdigit()]
    if wanted:
        await db.refresh(service, attribute_names=["addons"])
        allowed = {a.id for a in (service.addons or [])}
        wanted = [i for i in wanted if i in allowed]
        if wanted:
            for a in (await db.execute(select(Service).where(Service.id.in_(wanted)))).scalars().all():
                base += Decimal(str(a.price or 0))
    promo = promo_service.best_for(await promo_service.active_promotions(db, business_id), service_id, start_time.replace(tzinfo=None))
    final = promo_service.discounted(base, promo.discount_percent) if promo else base
    return {
        "base_price": float(base), "final_price": float(final), "discount_amount": float(base - final),
        "promotion": {"id": promo.id, "name": promo.name, "discount_percent": promo.discount_percent, "label": promo_service.label(promo)} if promo else None,
    }
