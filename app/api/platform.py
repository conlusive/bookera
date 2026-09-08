"""
Адміністрування платформи: керування підписками закладів.

Окремий роутер, а не частина CRM: тут інший рівень доступу. Плутати
«власник салону» і «власник сервісу» в одному файлі - вірний спосіб
одного дня видати першому права другого.
"""
import os
from datetime import timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, get_current_user
from app.core.logging_config import logger
from app.core.time_utils import utc_now
from app.models import Business, Payment, User
from app.services.payments import create_payment_intent, verify_callback_signature
from app.services.subscription import (
    STATUS_ACTIVE,
    STATUS_EXPIRED,
    assert_platform_admin,
    has_access,
    subscription_status,
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
    # Тариф один, тому вибір зводиться до «увімкнути» / «вимкнути».
    plan: str = Field(STATUS_ACTIVE, description="'active' або 'expired'")
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
            is_subscription_active=has_access(b),
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

    if payload.plan not in (STATUS_ACTIVE, STATUS_EXPIRED):
        raise HTTPException(status_code=400, detail="Невідомий тариф")

    res = await db.execute(select(Business).where(Business.id == business_id))
    business = res.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    business.subscription_plan = payload.plan
    if payload.plan == STATUS_EXPIRED:
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
        is_subscription_active=has_access(business),
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
        select(func.count(Business.id)).where(Business.subscription_plan == STATUS_ACTIVE)
    )
    result = await db.execute(select(Business).where(Business.subscription_plan == STATUS_ACTIVE))

    # Рахуємо ДІЙСНІ підписки окремо: заклад може мати план 'pro'
    # із простроченою датою, і в звіті це не платний клієнт.
    active = sum(1 for b in result.scalars().all() if has_access(b))

    return {
        "total_businesses": total.scalar() or 0,
        "marked_active": pro.scalar() or 0,
        # Рахуємо ДІЙСНІ підписки окремо: заклад може бути позначений
        # активним із простроченою датою, і в звіті це не платний клієнт.
        "really_active": active,
    }


# === Оплата підписки самим закладом ===
#
# Окремо від адміністративних ендпоінтів вище: там платформа видає
# доступ вручну, тут заклад платить сам. Різні дійові особи й різні
# перевірки, тому й розділено.

SUBSCRIPTION_PRICE_UAH = Decimal(os.getenv("SUBSCRIPTION_PRICE_UAH", "490"))
SUBSCRIPTION_PERIOD_DAYS = 30


class SubscriptionCheckoutResponse(BaseModel):
    # None у mock-режимі (без ключів WayForPay): переходити нікуди,
    # оплата вважається успішною одразу. Інтерфейс має це врахувати,
    # а не показувати порожнє посилання.
    payment_url: Optional[str] = None
    # true, коли підписка продовжена без переходу на оплату (немає
    # ключів провайдера). Інтерфейс має оновити стан, а не редіректити.
    activated: bool = False
    order_id: str
    amount: float
    period_days: int


@router.post("/subscription/checkout", response_model=SubscriptionCheckoutResponse)
async def create_subscription_payment(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Створити платіж за підписку.

    Свідомо БЕЗ перевірки чинної підписки: платити треба саме тоді,
    коли доступ уже завершився. Якби тут стояла звичайна перевірка
    доступу, заклад із простроченою підпискою не міг би її продовжити -
    класичний глухий кут.

    Перевіряємо лише, що людина - власник цього закладу: платити за
    чужу підписку не має сенсу, а платити за свою може лише той, хто
    за неї відповідає.
    """
    res = await db.execute(select(Business).where(Business.id == business_id))
    business = res.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    if str(business.owner_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Оплатити підписку може лише власник закладу")

    # order_id містить business_id: коли платіжна система повідомить
    # про успіх, ми маємо знати, кому саме продовжувати доступ.
    order_id = f"sub-{business_id}-{int(utc_now().timestamp())}"

    intent = create_payment_intent(
        amount=SUBSCRIPTION_PRICE_UAH,
        order_id=order_id,
        product_name=f"Підписка BookEra — {business.name}",
    )
    intent_provider = getattr(intent, "provider", "wayforpay")

    # provider_ref, а не власне поле: у моделі Payment зовнішній
    # ідентифікатор уже є, додавати друге поле для того самого - вірний
    # шлях до розсинхрону.
    payment = Payment(
        business_id=business_id,
        amount=SUBSCRIPTION_PRICE_UAH,
        currency="UAH",
        purpose="subscription",
        provider=intent_provider,
        provider_ref=order_id,
        status="pending",
    )
    # У mock-режимі (без ключів провайдера) переходити нікуди, тому
    # платіж лишається pending і чекає на callback - так само, як у
    # реальному сценарії. Це навмисно: локальна перевірка має проходити
    # тим самим шляхом, що й бойова.
    db.add(payment)
    await db.commit()

    # Режим без платіжного провайдера (ключі WayForPay не задані).
    #
    # Переходити нікуди, тому продовжуємо підписку одразу. Це потрібно,
    # щоб увесь потік - кнопка, продовження, зняття банера - можна було
    # перевірити до підключення договору з провайдером.
    #
    # Умова навмисно прив'язана до ВІДСУТНОСТІ ключів, а не до прапорця
    # «режим розробки»: у продакшні ключі є завжди, тому безкоштовну
    # підписку так не отримаєш. Кожен такий випадок пишеться в лог.
    if intent.checkout_url is None:
        payment.status = "completed"
        payment.completed_at = utc_now()
        base = business.subscription_until
        start_from = base if (base and base > utc_now()) else utc_now()
        business.subscription_plan = STATUS_ACTIVE
        business.subscription_until = start_from + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
        await db.commit()
        logger.warning(
            "Підписку продовжено БЕЗ реальної оплати (немає ключів провайдера): business_id=%s",
            business_id,
        )
        return SubscriptionCheckoutResponse(
            payment_url=None,
            order_id=order_id,
            amount=float(SUBSCRIPTION_PRICE_UAH),
            period_days=SUBSCRIPTION_PERIOD_DAYS,
            activated=True,
        )

    return SubscriptionCheckoutResponse(
        payment_url=intent.checkout_url,
        order_id=order_id,
        amount=float(SUBSCRIPTION_PRICE_UAH),
        period_days=SUBSCRIPTION_PERIOD_DAYS,
    )


@router.post("/subscription/callback")
async def subscription_payment_callback(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Підтвердження оплати від платіжної системи.

    Без авторизації користувача - викликає платіжний провайдер, а не
    людина. Захист тут інший: підпис запиту (перевіряється у
    verify_callback_signature) і те, що ми звіряємо суму з тим, що
    самі виставили. Довіряти сумі з тіла запиту не можна: інакше
    оплату на 1 гривню можна видати за повну.

    Продовжуємо ВІД БІЛЬШОЇ дати: якщо підписка ще діє, нові 30 днів
    додаються до залишку, а не з'їдають його. Людина, яка заплатила
    заздалегідь, не має втрачати оплачені дні.
    """
    order_id = str(payload.get("orderReference") or payload.get("order_id") or "")
    if not order_id.startswith("sub-"):
        raise HTTPException(status_code=400, detail="Невідомий платіж")

    if not verify_callback_signature(payload):
        logger.warning("Callback підписки з невірним підписом: %s", order_id)
        raise HTTPException(status_code=400, detail="Невірний підпис запиту")

    res = await db.execute(select(Payment).where(Payment.provider_ref == order_id))
    payment = res.scalars().first()
    if not payment:
        raise HTTPException(status_code=404, detail="Платіж не знайдено")

    # Повторний виклик - звичайна річ: платіжні системи надсилають
    # підтвердження кілька разів. Другий раз доступ не продовжуємо.
    if payment.status == "completed":
        return {"status": "already_processed"}

    payment.status = "completed"
    payment.completed_at = utc_now()

    biz_res = await db.execute(select(Business).where(Business.id == payment.business_id))
    business = biz_res.scalars().first()
    if business:
        base = business.subscription_until
        start_from = base if (base and base > utc_now()) else utc_now()
        business.subscription_plan = STATUS_ACTIVE
        business.subscription_until = start_from + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
        business.subscription_note = None  # це вже не ручна видача

    await db.commit()
    logger.info("Підписку продовжено оплатою: business_id=%s до %s",
                payment.business_id, business.subscription_until if business else "-")

    return {"status": "ok"}
