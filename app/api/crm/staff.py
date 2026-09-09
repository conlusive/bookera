import secrets
from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, assert_business_admin, get_current_user
from app.core.email import send_email_sync
from app.core.time_utils import utc_now
from app.models import StaffInvite, User, Business, StaffMembership
from app.schemas.staff import StaffInviteCreate, StaffInviteResponse, InviteAccept, StaffUpdate, StaffResponse

router = APIRouter(tags=["CRM - Staff"])

INVITE_EXPIRY_DAYS = 7


@router.post("/crm/businesses/{business_id}/invites", response_model=StaffInviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    business_id: int,
    invite_in: StaffInviteCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_admin(db, current_user, business_id)

    biz_res = await db.execute(select(Business).where(Business.id == business_id))
    business = biz_res.scalars().first()

    invite = StaffInvite(
        business_id=business_id,
        email=invite_in.email,
        role=invite_in.role,
        token=secrets.token_urlsafe(32),
        status="pending",
        invited_by=current_user.id,
        expires_at=utc_now() + timedelta(days=INVITE_EXPIRY_DAYS),
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    background_tasks.add_task(
        send_email_sync,
        to_email=invite.email,
        subject=f"Запрошення приєднатись до {business.name if business else 'команди'} на Bookera",
        html_content=(
            f"<p>Вас запросили приєднатись до команди <b>{business.name if business else ''}</b> на Bookera.</p>"
            f"<p>Токен запрошення: <code>{invite.token}</code></p>"
        ),
    )
    return invite


@router.get("/crm/businesses/{business_id}/invites", response_model=List[StaffInviteResponse])
async def list_invites(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_admin(db, current_user, business_id)
    result = await db.execute(select(StaffInvite).where(StaffInvite.business_id == business_id))
    return result.scalars().all()


@router.post("/public/invites/accept")
async def accept_invite(
    payload: InviteAccept,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Публічний ендпоінт (але все одно вимагає залогіненого користувача -
    людина спершу створює акаунт через Supabase, потім приймає запрошення)."""
    result = await db.execute(select(StaffInvite).where(StaffInvite.token == payload.token))
    invite = result.scalars().first()

    if not invite:
        raise HTTPException(status_code=404, detail="Запрошення не знайдено")
    if invite.status != "pending":
        raise HTTPException(status_code=400, detail="Це запрошення вже використане або скасоване")
    if invite.expires_at < utc_now():
        invite.status = "expired"
        await db.commit()
        raise HTTPException(status_code=400, detail="Термін дії запрошення сплив")

    user_res = await db.execute(select(User).where(User.id == current_user.id))
    user = user_res.scalars().first()
    if not user:
        user = User(id=current_user.id, email=current_user.email or invite.email, role=invite.role, full_name=current_user.full_name)
        db.add(user)
        # Записуємо користувача в базу ДО того, як на нього пошлються
        # членство й поле accepted_by у запрошенні. Без цього flush
        # SQLAlchemy може вставити посилання раніше за сам рядок -
        # і база відхилить його за зовнішнім ключем.
        await db.flush()

    user.business_id = invite.business_id
    user.role = invite.role

    # Членство - окремий запис, бо людина може працювати в кількох
    # закладах. user.business_id лишається «поточним закладом»: тим,
    # у якому людина зараз, і на нього спирається вся логіка доступу.
    m_res = await db.execute(
        select(StaffMembership).where(
            StaffMembership.user_id == str(user.id),
            StaffMembership.business_id == invite.business_id,
        )
    )
    membership = m_res.scalars().first()
    if membership:
        # Повернення після звільнення: відновлюємо, а не створюємо
        # другий запис - унікальність не дозволить, та й історія
        # приєднання цінніша за чистий новий рядок.
        membership.is_active = True
        membership.left_at = None
        membership.role = invite.role
    else:
        db.add(StaffMembership(
            user_id=str(user.id),
            business_id=invite.business_id,
            role=invite.role,
        ))

    invite.status = "accepted"
    invite.accepted_by = current_user.id

    await db.commit()
    return {"status": "success", "business_id": invite.business_id, "role": invite.role}


@router.get("/crm/businesses/{business_id}/staff", response_model=List[StaffResponse])
async def list_staff(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_access(db, current_user, business_id)
    result = await db.execute(select(User).where(User.business_id == business_id))
    return result.scalars().all()


@router.patch("/crm/staff/{staff_id}", response_model=StaffResponse)
async def update_staff(
    staff_id: str,
    payload: StaffUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == staff_id))
    staff = result.scalars().first()
    if not staff or not staff.business_id:
        raise HTTPException(status_code=404, detail="Співробітника не знайдено")

    # Кожен може редагувати ВЛАСНУ картку (імʼя, телефон, спеціалізація),
    # але змінювати чужі - лише адмін/власник.
    is_self = str(staff.id) == str(current_user.id)
    if is_self:
        await assert_business_access(db, current_user, staff.business_id)
    else:
        await assert_business_admin(db, current_user, staff.business_id)

    data = payload.model_dump(exclude_unset=True)

    # Навіть про себе звичайний майстер не може підняти собі роль чи
    # переписати власну ставку - це справа адміністрації.
    if is_self:
        level_res = await db.execute(select(User).where(User.id == str(current_user.id)))
        me = level_res.scalars().first()
        from app.core.auth import ADMIN_ROLES
        biz_res = await db.execute(select(Business).where(Business.id == staff.business_id))
        biz = biz_res.scalars().first()
        is_admin = (biz and str(biz.owner_id) == str(current_user.id)) or (me and me.role in ADMIN_ROLES)
        if not is_admin:
            for protected in ("role", "commission_rate", "fixed_salary", "tax_rate", "is_active"):
                data.pop(protected, None)

    for field, value in data.items():
        setattr(staff, field, value)
    await db.commit()
    await db.refresh(staff)
    return staff


@router.delete("/crm/staff/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_staff(
    staff_id: str,
    business_id: Optional[int] = Query(None, description="З якого закладу звільнити"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Звільнити співробітника з закладу.

    business_id обовʼязковий за змістом, хоч і не за формою: раніше
    звільняли з ПОТОЧНОГО закладу майстра (staff.business_id), і поки
    людина працювала в одному місці, це збігалось. Тепер майстер може
    працювати в кількох, і власник салону А не має звільняти людину
    з салону Б лише тому, що вона зараз переключена туди.

    Без параметра лишаємо стару поведінку - щоб не зламати виклики,
    які його ще не передають.
    """
    result = await db.execute(select(User).where(User.id == staff_id))
    staff = result.scalars().first()
    if not staff:
        raise HTTPException(status_code=404, detail="Співробітника не знайдено")

    target_business_id = business_id or staff.business_id
    if not target_business_id:
        raise HTTPException(status_code=404, detail="Співробітника не знайдено")

    await assert_business_admin(db, current_user, target_business_id)
    if str(staff.id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Не можна видалити самого себе")

    # Закриваємо членство саме в ЦЬОМУ закладі, а не звільняємо людину
    # звідусіль: вона може працювати ще десь, і той заклад тут ні до чого.
    m_res = await db.execute(
        select(StaffMembership).where(
            StaffMembership.user_id == str(staff.id),
            StaffMembership.business_id == target_business_id,
        )
    )
    membership = m_res.scalars().first()
    if membership:
        # Не видаляємо запис: історія візитів посилається на майстра,
        # і втратити звʼязок означає зіпсувати звіти за минулі періоди.
        membership.is_active = False
        membership.left_at = utc_now()

    # Якщо лишились інші заклади - переводимо людину в один із них,
    # інакше вона опиниться в кабінеті без закладу взагалі.
    other = await db.execute(
        select(StaffMembership).where(
            StaffMembership.user_id == str(staff.id),
            StaffMembership.business_id != target_business_id,
            StaffMembership.is_active.is_(True),
        ).limit(1)
    )
    fallback = other.scalars().first()
    if fallback:
        staff.business_id = fallback.business_id
        staff.role = fallback.role
    else:
        staff.business_id = None
        staff.is_active = False

    await db.commit()
