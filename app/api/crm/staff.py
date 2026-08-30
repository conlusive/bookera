import secrets
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, get_current_user
from app.core.email import send_email_sync
from app.models import StaffInvite, User, Business
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
    await assert_business_access(db, current_user, business_id)

    biz_res = await db.execute(select(Business).where(Business.id == business_id))
    business = biz_res.scalars().first()

    invite = StaffInvite(
        business_id=business_id,
        email=invite_in.email,
        role=invite_in.role,
        token=secrets.token_urlsafe(32),
        status="pending",
        invited_by=current_user.id,
        expires_at=datetime.utcnow() + timedelta(days=INVITE_EXPIRY_DAYS),
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
    await assert_business_access(db, current_user, business_id)
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
    if invite.expires_at < datetime.utcnow():
        invite.status = "expired"
        await db.commit()
        raise HTTPException(status_code=400, detail="Термін дії запрошення сплив")

    user_res = await db.execute(select(User).where(User.id == current_user.id))
    user = user_res.scalars().first()
    if not user:
        user = User(id=current_user.id, email=current_user.email or invite.email, role=invite.role)
        db.add(user)

    user.business_id = invite.business_id
    user.role = invite.role
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
    await assert_business_access(db, current_user, staff.business_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(staff, field, value)
    await db.commit()
    await db.refresh(staff)
    return staff


@router.delete("/crm/staff/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_staff(
    staff_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == staff_id))
    staff = result.scalars().first()
    if not staff or not staff.business_id:
        raise HTTPException(status_code=404, detail="Співробітника не знайдено")
    await assert_business_access(db, current_user, staff.business_id)
    if str(staff.id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Не можна видалити самого себе")

    staff.business_id = None
    staff.is_active = False
    await db.commit()
