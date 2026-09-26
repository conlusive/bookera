import secrets
from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, assert_business_admin, get_current_user
from app.core.email import send_email_sync
from app.core.time_utils import utc_now
from app.models import StaffInvite, User, Business, StaffMembership
from app.schemas.staff import StaffInviteCreate, StaffInviteResponse, InviteAccept, StaffUpdate, StaffResponse

router = APIRouter(tags=["CRM - Staff"])

INVITE_EXPIRY_DAYS = 7


import os

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ROLE_LABELS = {"master": "майстра", "admin": "адміністратора"}


def _invite_url(invite: StaffInvite) -> str:
    return f"{FRONTEND_URL}/invite?token={invite.token}"


def _with_url(invite: StaffInvite) -> StaffInviteResponse:
    out = StaffInviteResponse.model_validate(invite, from_attributes=True)
    out.invite_url = _invite_url(invite)
    return out


def _invite_email(invite: StaffInvite, business_name: str) -> str:
    """
    Лист із КНОПКОЮ. Раніше в листі був лише сирий токен без посилання -
    майстрові не було на що натиснути.
    """
    url = _invite_url(invite)
    role = ROLE_LABELS.get(invite.role, "члена команди")
    return f"""
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;color:#1D1D1F">
      <h2 style="font-size:22px;margin:0 0 12px">Вас запросили в команду</h2>
      <p style="font-size:15px;line-height:1.55;color:#3A3A3C;margin:0 0 22px">
        <b>{business_name}</b> запрошує вас у BookEra як {role}. Ви бачитимете свій
        розклад і записи клієнтів.
      </p>
      <a href="{url}" style="display:inline-block;background:#1D1D1F;color:#fff;text-decoration:none;
         padding:13px 22px;border-radius:12px;font-size:15px;font-weight:600">Прийняти запрошення</a>
      <p style="font-size:13px;color:#86868B;margin:22px 0 0">
        Запрошення дійсне {INVITE_EXPIRY_DAYS} днів. Якщо кнопка не працює, відкрийте посилання:<br>
        <a href="{url}" style="color:#6F9273;word-break:break-all">{url}</a>
      </p>
    </div>
    """


@router.post("/crm/businesses/{business_id}/invites", response_model=StaffInviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    business_id: int,
    invite_in: StaffInviteCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_admin(db, current_user, business_id)
    business = (await db.execute(select(Business).where(Business.id == business_id))).scalars().first()
    email = str(invite_in.email).strip().lower()

    # Людина вже в команді - друге запрошення їй ні до чого.
    already = await db.execute(
        select(StaffMembership).join(User, User.id == StaffMembership.user_id).where(
            StaffMembership.business_id == business_id,
            StaffMembership.is_active.is_(True),
            func.lower(User.email) == email,
        )
    )
    if already.scalars().first():
        raise HTTPException(status_code=409, detail="Ця людина вже у вашій команді")

    # Запрошення вже чекає - оновлюємо строк і шлемо лист ще раз, а не
    # плодимо дублікати в списку «очікують».
    pending = (await db.execute(
        select(StaffInvite).where(
            StaffInvite.business_id == business_id,
            func.lower(StaffInvite.email) == email,
            StaffInvite.status == "pending",
        )
    )).scalars().first()

    if pending:
        pending.role = invite_in.role
        pending.expires_at = utc_now() + timedelta(days=INVITE_EXPIRY_DAYS)
        invite = pending
    else:
        invite = StaffInvite(
            business_id=business_id,
            email=email,
            role=invite_in.role,
            token=secrets.token_urlsafe(32),
            status="pending",
            invited_by=current_user.id,
            expires_at=utc_now() + timedelta(days=INVITE_EXPIRY_DAYS),
        )
        db.add(invite)
    await db.commit()
    await db.refresh(invite)

    name = business.name if business else "Заклад"
    background_tasks.add_task(
        send_email_sync,
        to_email=invite.email,
        subject=f"{name} запрошує вас у команду",
        html_content=_invite_email(invite, name),
    )
    return _with_url(invite)


@router.get("/crm/businesses/{business_id}/invites", response_model=List[StaffInviteResponse])
async def list_invites(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Запрошення, що ще чекають, - для списку «Очікують» у команді."""
    await assert_business_admin(db, current_user, business_id)
    rows = (await db.execute(
        select(StaffInvite).where(StaffInvite.business_id == business_id, StaffInvite.status == "pending")
        .order_by(StaffInvite.created_at.desc())
    )).scalars().all()
    now = utc_now()
    return [_with_url(i) for i in rows if i.expires_at and i.expires_at > now]


@router.delete("/crm/businesses/{business_id}/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invite(
    business_id: int,
    invite_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Скасувати запрошення: посилання з нього більше не спрацює."""
    await assert_business_admin(db, current_user, business_id)
    invite = (await db.execute(
        select(StaffInvite).where(StaffInvite.id == invite_id, StaffInvite.business_id == business_id)
    )).scalars().first()
    if not invite:
        raise HTTPException(status_code=404, detail="Запрошення не знайдено")
    if invite.status == "pending":
        invite.status = "cancelled"
        await db.commit()


@router.get("/public/invites/{token}")
async def invite_info(token: str, db: AsyncSession = Depends(get_db)):
    """
    Що за запрошення - для сторінки прийняття, ще ДО входу. Людина має
    бачити, куди її кличуть, перш ніж реєструватись.
    """
    invite = (await db.execute(select(StaffInvite).where(StaffInvite.token == token))).scalars().first()
    if not invite:
        raise HTTPException(status_code=404, detail="Запрошення не знайдено")
    business = (await db.execute(select(Business).where(Business.id == invite.business_id))).scalars().first()
    expired = invite.status == "pending" and invite.expires_at < utc_now()
    return {
        "business_name": business.name if business else None,
        "business_logo": (business.logo if business else None),
        "role": invite.role,
        "email": invite.email,
        "status": "expired" if expired else invite.status,
    }


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

    # Перше налаштування оплати - точка відліку для зарплати. Достатньо
    # ставки (відсоток чи фіксована): платити можна й вручну, без
    # нагадувань. Період виплат потрібен лише для нагадувань «пора платити».
    has_scheme = (staff.commission_rate or 0) > 0 or (staff.fixed_salary or 0) > 0
    if {"commission_rate", "fixed_salary"} & set(data) and has_scheme and staff.pay_configured_at is None:
        staff.pay_configured_at = utc_now()
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
