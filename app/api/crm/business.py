import re
import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.services.business_profile import default_booking_settings
from app.services.subscription import STATUS_TRIAL, subscription_state, trial_until
from app.core.auth import CurrentUser, assert_business_access, assert_business_admin, get_current_user
from pydantic import BaseModel
from app.core.logging_config import logger
from app.models import Business, RoleEnum, BusinessHours, User
from app.schemas.business import BusinessCreate, BusinessUpdate, BusinessOut, BusinessHoursItem

router = APIRouter(prefix="/crm/businesses", tags=["CRM - Business"])

# ПРИМІТКА: тут навмисно немає DELETE /{business_id}. У моделі Business
# каскадне видалення (services, appointments, clients, invites, reviews,
# inventory, expenses - усе з cascade="all, delete-orphan") означає, що
# фізичне видалення бізнесу назавжди стирає всю історію бронювань і фінансів.
# "Видалення" бізнесу - це PATCH з is_active=false (soft delete), не DELETE.


@router.get("/{business_id}/masters")
async def list_public_masters(business_id: int, db: AsyncSession = Depends(get_db)):
    """
    Публічний список майстрів для клієнта, що обирає, до кого записатись -
    навмисно віддає лише безпечні поля (без телефону/email/комісії),
    на відміну від /crm/businesses/{id}/staff, який вимагає авторизації.
    """
    result = await db.execute(
        select(User).where(User.business_id == business_id, User.role.in_(["master", "business_owner"]), User.is_active == True)
    )
    return [
        {"id": u.id, "full_name": u.full_name, "specialization": u.specialization, "avatar_url": u.avatar_url}
        for u in result.scalars().all()
    ]


@router.post("/{business_id}/apply-profile-defaults")
async def apply_profile_defaults(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Оновити правила бронювання за поточним профілем закладу.

    Окрема дія, а не автоматика при зміні напряму: власник міг
    налаштувати крок і буфер вручну, і мовчки скинути його роботу,
    бо він виправив категорію, було б грубо.

    Тут перезаписуємо саме ті поля, що випливають із профілю. Політика
    скасування, закриті періоди й вимикачі не чіпаються - вони до
    напряму діяльності не мають стосунку.
    """
    await assert_business_admin(db, current_user, business_id)

    res = await db.execute(select(Business).where(Business.id == business_id))
    business = res.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    defaults = default_booking_settings(
        business.category, business.business_type, business.workspace_type
    )
    derived_keys = ("time_step", "default_duration", "buffer_minutes",
                    "min_advance_hours", "max_advance_days")

    business.booking_settings = {
        **(business.booking_settings or {}),
        **{k: defaults[k] for k in derived_keys if k in defaults},
    }
    await db.commit()
    await db.refresh(business)

    return {"booking_settings": business.booking_settings}


@router.get("/me")
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Хто я і до якого бізнесу належу - заміняє стару таблицю 'profiles',
    якої більше немає. User.business_id - єдине надійне джерело "мого
    бізнесу" (виставляється і власнику, і персоналу однаково при
    реєстрації/прийнятті запрошення).
    """
    user_res = await db.execute(select(User).where(User.id == current_user.id))
    user = user_res.scalars().first()

    if not user:
        return {"id": current_user.id, "email": current_user.email, "role": None, "business_id": None, "business": None}

    business_data = None
    if user.business_id:
        biz_res = await db.execute(
            select(Business).where(Business.id == user.business_id).options(selectinload(Business.services))
        )
        biz = biz_res.scalars().first()
        if biz:
            # Доповнюємо налаштування значеннями за профілем закладу.
            #
            # Заклади, створені ДО появи цієї логіки, мають порожні або
            # неповні booking_settings - і людина не бачить у налаштуваннях
            # того, що вказувала при реєстрації. Доповнюємо лише відсутні
            # ключі: те, що власник змінив вручну, чіпати не можна.
            defaults = default_booking_settings(biz.category, biz.business_type, biz.workspace_type)
            current = dict(biz.booking_settings or {})
            missing = {k: v for k, v in defaults.items() if k not in current}
            if missing:
                biz.booking_settings = {**defaults, **current}
                await db.commit()
                await db.refresh(biz)

            business_data = BusinessOut.model_validate(biz)

    return {
        "id": user.id,
        "email": user.email,
        # Стан підписки віддаємо ЗАВЖДИ, навіть простроченої: людина
        # з закритим доступом мусить бачити, що саме прострочено,
        # і мати змогу оплатити.
        "subscription": subscription_state(biz) if user.business_id and biz else None,
        "full_name": user.full_name,
        "role": user.role,
        "business_id": user.business_id,
        "business": business_data,
    }


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
        user = User(id=current_user.id, email=current_user.email or "", role="business_owner", full_name=current_user.full_name)
        db.add(user)
        await db.flush()
    else:
        user.role = "business_owner"
        if not user.full_name and current_user.full_name:
            user.full_name = current_user.full_name

    # Правила бронювання виводимо з того, що людина вказала при
    # реєстрації. Раніше всі отримували однакові значення, і власник
    # мусив сам здогадуватись, що для манікюру крок у 30 хвилин
    # незручний, а для виїзду до клієнта запис «через годину» нереальний.
    if not data.get("booking_settings"):
        data["booking_settings"] = default_booking_settings(
            data.get("category"),
            data.get("business_type"),
            data.get("workspace_type"),
        )

    # Пробний період: без нього людина не може навіть подивитись, за що
    # платить, і реєстрація перетворюється на сліпу покупку.
    data["subscription_plan"] = STATUS_TRIAL
    data["subscription_until"] = trial_until()

    business = Business(
        **data,
        owner_id=current_user.id,
        slug=slugify(payload.name),
        direct_link_token=secrets.token_urlsafe(12),
    )
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
    await assert_business_admin(db, current_user, business_id)
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


@router.get("/{business_id}/hours", response_model=List[BusinessHoursItem])
async def get_business_hours(
    business_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Публічне читання (потрібне і клієнтському сайту, і CRM) - лише запис через PUT захищений."""
    result = await db.execute(select(BusinessHours).where(BusinessHours.business_id == business_id))
    return result.scalars().all()


@router.put("/{business_id}/hours", response_model=List[BusinessHoursItem])
async def set_business_hours(
    business_id: int,
    hours: List[BusinessHoursItem],
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_admin(db, current_user, business_id)

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


class BusinessDeleteRequest(BaseModel):
    # Підтвердження назвою, а не галочкою: галочку ставлять не читаючи,
    # а щоб надрукувати назву закладу, треба усвідомити, що видаляєш.
    confirm_name: str


@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_business(
    business_id: int,
    payload: BusinessDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Видалити заклад разом з усіма даними.

    Право на видалення даних - вимога законодавства про персональні
    дані, і формальної можливості «напишіть у підтримку» тут недосить.

    Видаляє ЛИШЕ власник: адміністратор керує закладом щодня, але
    закрити бізнес - рішення того, кому він належить.

    Видалення повне, без «м'якого» прапорця.Напів-видалений заклад, який
    лишається в базі, - це саме те, від чого закон і захищає. Виняток
    один: історія платежів залишається знеособленою, бо фінансові
    записи мають зберігатись за іншими правилами.
    """
    res = await db.execute(select(Business).where(Business.id == business_id))
    business = res.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    if str(business.owner_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Видалити заклад може лише власник",
        )

    if payload.confirm_name.strip() != business.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Назва не збігається. Введіть назву закладу точно.",
        )

    # Відвʼязуємо персонал, а не видаляємо: люди мають облікові записи,
    # якими користуються і в інших закладах.
    staff_res = await db.execute(select(User).where(User.business_id == business_id))
    for member in staff_res.scalars().all():
        member.business_id = None
        member.role = RoleEnum.CLIENT

    logger.warning(
        "Заклад видалено: id=%s name=%s owner=%s",
        business.id, business.name, business.owner_id,
    )

    await db.delete(business)
    await db.commit()
