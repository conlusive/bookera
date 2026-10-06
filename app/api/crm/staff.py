import secrets
from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, assert_business_admin, get_current_user
from app.core.email import send_email_sync
from app.core.email_layout import esc
from app.core.time_utils import utc_now
from app.models import StaffInvite, User, Business, StaffMembership
from app.schemas.staff import StaffInviteCreate, StaffInviteResponse, InviteAccept, StaffUpdate, StaffResponse

STAFF_LABELS = {
    "full_name": "Імʼя", "phone": "Телефон", "specialization": "Спеціалізація", "role": "Роль",
    "commission_rate": "Відсоток від виручки, %", "fixed_salary": "Фіксована ставка, ₴", "tax_rate": "Податок, %",
    "payment_method": "Спосіб виплати", "payout_period": "Період виплат", "payout_day": "День виплати",
    "tips_full": "Чайові майстрові", "deduct_materials": "Віднімати матеріали", "auto_reset_balance": "Автоскидання балансу",
    "provides_services": "Надає послуги", "show_in_storefront": "Показувати у вітрині", "assigned_services": "Послуги майстра",
    "avatar_url": "Фото", "is_active": "Активний",
}

from app.core.rate_limit import rate_limit

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
    from app.core.email_layout import button, layout
    url = _invite_url(invite)
    role = ROLE_LABELS.get(invite.role, "члена команди")
    intro = (
        f"<b>{esc(business_name)}</b> запрошує вас у BookEra як {esc(role)}. "
        "Ви бачитимете свій розклад і записи клієнтів."
    )
    return layout(
        business_name=business_name,
        title="Вас запросили в команду",
        intro=intro,
        body_html=button("Прийняти запрошення", url),
        footer_note=(
            f"Запрошення дійсне {INVITE_EXPIRY_DAYS} днів. Якщо кнопка не працює, відкрийте посилання:<br>"
            f'<a href="{esc(url)}" style="color:#6B756A;word-break:break-all;">{esc(url)}</a>'
        ),
    )


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

    # Не більше 30 запрошень на добу з одного закладу: інакше це канал розсилки листів на довільні адреси
    sent_today = (await db.execute(
        select(func.count(StaffInvite.id)).where(
            StaffInvite.business_id == business_id,
            StaffInvite.created_at > utc_now() - timedelta(days=1),
        )
    )).scalar() or 0
    if sent_today >= 30:
        raise HTTPException(status_code=429, detail="Забагато запрошень за добу. Спробуйте завтра.")

    # Роль адміністратора видає лише власник - так само, як і зміна ролей (PUT .../access)
    if invite_in.role == "admin" and not (business and str(business.owner_id) == str(current_user.id)):
        raise HTTPException(status_code=403, detail="Запросити адміністратора може лише власник закладу")

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
    # Журнал дій
    from app.services.audit import record as _audit
    await _audit(db, business_id, str(current_user.id), "team", "invited", f"Запрошено {email} ({invite.role})")
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
async def invite_info(token: str, db: AsyncSession = Depends(get_db), _rl=Depends(rate_limit("invite", max_requests=30, window_seconds=600))):
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
    _rl=Depends(rate_limit("invite", max_requests=30, window_seconds=600)),
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

    # Запрошення діє лише для тієї пошти, на яку його створено: інакше хто завгодно з посиланням
    # (воно могло витекти чи бути переслане) отримав би роль у чужому закладі.
    if invite.email and (current_user.email or "").strip().lower() != str(invite.email).strip().lower():
        raise HTTPException(status_code=403, detail="Це запрошення створено для іншої електронної адреси. Увійдіть з тією поштою, на яку воно надійшло.")

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
    # За ЧЛЕНСТВОМ: раніше список брав людей, у кого цей заклад -
    # поточний, і майстер, що перемкнувся в інший салон, зникав із
    # команди першого. Роль і графік - саме в цьому закладі.
    rows = (await db.execute(
        select(User, StaffMembership)
        .join(StaffMembership, StaffMembership.user_id == User.id)
        .where(StaffMembership.business_id == business_id, StaffMembership.is_active.is_(True))
    )).all()
    seen, out = set(), []
    for user, m in rows:
        resp = StaffResponse.model_validate(user, from_attributes=True)
        resp.role = m.role or resp.role
        resp.shifts = m.shifts
        out.append(resp); seen.add(user.id)
    # Старі записи без членства - як і раніше, за поточним закладом.
    for user in (await db.execute(select(User).where(User.business_id == business_id))).scalars().all():
        if user.id not in seen:
            out.append(StaffResponse.model_validate(user, from_attributes=True))
    return out


@router.patch("/crm/staff/{staff_id}", response_model=StaffResponse)
async def update_staff(
    staff_id: str,
    payload: StaffUpdate,
    business_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == staff_id))
    staff = result.scalars().first()
    if not staff or not (staff.business_id or business_id):
        raise HTTPException(status_code=404, detail="Співробітника не знайдено")

    # Заклад, У ЯКОМУ редагують: із запиту, а не «поточний» заклад майстра.
    # Інакше адміністратор салону А не міг би змінити майстра, що зараз
    # перемкнувся в салон Б.
    ctx_business_id = business_id or staff.business_id
    membership = (await db.execute(select(StaffMembership).where(
        StaffMembership.user_id == str(staff.id), StaffMembership.business_id == ctx_business_id,
    ))).scalars().first()
    if business_id and not membership and staff.business_id != business_id:
        raise HTTPException(status_code=404, detail="Співробітника не знайдено в цьому закладі")

    # Кожен може редагувати ВЛАСНУ картку (імʼя, телефон, спеціалізація),
    # але змінювати чужі - лише адмін/власник.
    is_self = str(staff.id) == str(current_user.id)
    if is_self:
        await assert_business_access(db, current_user, ctx_business_id)
    else:
        await assert_business_admin(db, current_user, ctx_business_id)

    data = payload.model_dump(exclude_unset=True)

    # Навіть про себе звичайний майстер не може підняти собі роль чи
    # переписати власну ставку - це справа адміністрації.
    if is_self:
        level_res = await db.execute(select(User).where(User.id == str(current_user.id)))
        me = level_res.scalars().first()
        from app.core.auth import ADMIN_ROLES
        biz_res = await db.execute(select(Business).where(Business.id == ctx_business_id))
        biz = biz_res.scalars().first()
        is_admin = (biz and str(biz.owner_id) == str(current_user.id)) or (me and me.role in ADMIN_ROLES)
        if not is_admin:
            # shifts - графік виставляє салон, не сам майстер.
            for protected in ("role", "commission_rate", "fixed_salary", "tax_rate", "is_active", "shifts"):
                data.pop(protected, None)

    # Роль змінює ЛИШЕ власник - і через членство, як PUT .../access.
    # Раніше роль тут міг змінити адміністратор: підвищити будь-кого,
    # зокрема себе, в обхід правила «доступи роздає власник».
    if "role" in data:
        _biz = await db.get(Business, ctx_business_id)
        if not _biz or str(_biz.owner_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Змінювати роль може лише власник")
        if data["role"] in ("master", "admin") and membership is not None:
            membership.role = data["role"]

    # Графік - за закладом (членство), не за людиною.
    new_shifts = data.pop("shifts", None) if "shifts" in data else ...
    before = {f: getattr(staff, f, None) for f in data}
    for field, value in data.items():
        setattr(staff, field, value)
    from app.services.audit import changes_text, diff_changes, record as _audit_rec
    staff_changes = diff_changes(before, data, STAFF_LABELS)
    if new_shifts is not ...:
        staff_changes.append({"field": "shifts", "label": "Графік роботи"})
    if staff_changes:
        who = staff.full_name or staff.email or "співробітника"
        await _audit_rec(db, ctx_business_id, str(current_user.id), "team", "staff_updated",
                         f"Змінено {who}: {changes_text(staff_changes)}"[:500], meta={"staff_id": str(staff.id), "changes": staff_changes})
    if new_shifts is not ...:
        if membership is None:
            membership = StaffMembership(user_id=str(staff.id), business_id=ctx_business_id,
                                         role=str(getattr(staff.role, "value", staff.role) or "master"), is_active=True)
            db.add(membership)
        membership.shifts = new_shifts

    # Перше налаштування оплати - точка відліку для зарплати. Достатньо
    # ставки (відсоток чи фіксована): платити можна й вручну, без
    # нагадувань. Період виплат потрібен лише для нагадувань «пора платити».
    has_scheme = (staff.commission_rate or 0) > 0 or (staff.fixed_salary or 0) > 0
    if {"commission_rate", "fixed_salary"} & set(data) and has_scheme and staff.pay_configured_at is None:
        staff.pay_configured_at = utc_now()
    await db.commit()
    await db.refresh(staff)
    resp = StaffResponse.model_validate(staff, from_attributes=True)
    if membership is not None:
        resp.shifts = membership.shifts
        resp.role = membership.role or resp.role
    return resp


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

    # Власника не можна звільнити взагалі - навіть адміністратору (інтерфейс ховає кнопку,
    # але сервер мусить відмовляти сам). Спершу права передають іншій людині.
    owner_row = (await db.execute(select(Business.owner_id).where(Business.id == target_business_id))).first()
    if owner_row and owner_row[0] is not None and str(owner_row[0]) == str(staff.id):
        raise HTTPException(
            status_code=403,
            detail="Власника не можна звільнити. Спершу передайте права власності іншій людині.",
        )

    # Адміністраторів звільняє лише власник: ролі міняє тільки він, тож і прибрати адміністратора
    # (а з ним - усе, що він налаштував) не може інший адміністратор.
    target_role = (await db.execute(
        select(StaffMembership.role).where(
            StaffMembership.user_id == str(staff.id),
            StaffMembership.business_id == target_business_id,
            StaffMembership.is_active.is_(True),
        )
    )).scalar() or staff.role
    caller_is_owner = owner_row is not None and owner_row[0] is not None and str(owner_row[0]) == str(current_user.id)
    if target_role == "admin" and not caller_is_owner:
        raise HTTPException(status_code=403, detail="Адміністратора може звільнити лише власник закладу")

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

    # Журнал дій

    from app.services.audit import record as _audit

    await _audit(db, target_business_id, str(current_user.id), "team", "removed", f"Прибрано з команди: {staff.full_name or staff.email}")

    await db.commit()
