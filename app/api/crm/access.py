"""
Доступи команди й журнал дій.

  GET /crm/businesses/{bid}/me/access              - мої роль і розділи (для меню кабінету)
  GET /crm/businesses/{bid}/staff/{uid}/access     - роль і розділи людини
  PUT /crm/businesses/{bid}/staff/{uid}/access     - змінити (лише власник)
  GET /crm/businesses/{bid}/audit                  - журнал дій
"""
from datetime import date, datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    ROLE_DEFAULTS, SECTION_LABELS, SECTIONS, CurrentUser, assert_business_admin,
    effective_permissions, get_current_user,
)
from app.core.database import get_db
from app.models import Business, StaffMembership, User
from app.models.master_tools import AuditEvent
from app.services.audit import CATEGORIES, record

router = APIRouter(tags=["Access & audit"])

ROLE_LABEL = {"master": "майстер", "admin": "адміністратор"}


async def _is_owner(db: AsyncSession, business_id: int, user_id: str) -> bool:
    biz = await db.get(Business, business_id)
    return bool(biz and str(biz.owner_id) == str(user_id))


async def _membership(db: AsyncSession, business_id: int, user_id: str) -> Optional[StaffMembership]:
    return (await db.execute(select(StaffMembership).where(
        StaffMembership.user_id == str(user_id), StaffMembership.business_id == business_id,
        StaffMembership.is_active.is_(True),
    ))).scalars().first()


@router.get("/crm/businesses/{business_id}/me/access")
async def my_access(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Роль і розділи - щоб меню кабінету показувало саме те, що дозволено."""
    if await _is_owner(db, business_id, str(current_user.id)):
        return {"role": "owner", "sections": {s: True for s in SECTIONS}}
    m = await _membership(db, business_id, str(current_user.id))
    if not m:
        raise HTTPException(status_code=403, detail="Ви не працюєте в цьому закладі")
    if m.role in ("business_owner", "owner"):
        return {"role": "owner", "sections": {s: True for s in SECTIONS}}
    return {"role": m.role, "sections": effective_permissions(m.role, m.permissions)}


@router.get("/crm/businesses/{business_id}/staff/{staff_id}/access")
async def staff_access(
    business_id: int,
    staff_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_admin(db, current_user, business_id)
    if await _is_owner(db, business_id, staff_id):
        return {"role": "owner", "sections": {s: True for s in SECTIONS}, "editable": False}
    m = await _membership(db, business_id, staff_id)
    if not m:
        raise HTTPException(status_code=404, detail="Людину не знайдено в команді")
    return {
        "role": m.role,
        "sections": effective_permissions(m.role, m.permissions),
        "defaults": ROLE_DEFAULTS.get(m.role, ROLE_DEFAULTS["master"]),
        # Змінювати доступи може лише власник
        "editable": await _is_owner(db, business_id, str(current_user.id)),
    }


class AccessIn(BaseModel):
    role: Optional[Literal["master", "admin"]] = None
    sections: Optional[dict] = None


async def apply_access(db: AsyncSession, business_id: int, staff_id: str, actor_id: str,
                       role: Optional[str], sections: Optional[dict]) -> StaffMembership:
    """Спільне для прямої зміни власником і погодженого запиту на доступ."""
    m = await _membership(db, business_id, staff_id)
    if not m:
        raise HTTPException(status_code=404, detail="Людину не знайдено в команді")
    before_role = m.role
    before = effective_permissions(m.role, m.permissions)

    if role and role != m.role:
        m.role = role
        user = (await db.execute(select(User).where(User.id == str(staff_id)))).scalars().first()
        # Роль у «поточному закладі» людини - та сама, що й у членстві
        if user and user.business_id == business_id:
            user.role = role
    target = dict(before if not role or role == before_role else effective_permissions(m.role, None))
    for k, v in (sections or {}).items():
        if k in SECTIONS:
            target[k] = bool(v)
    # Зберігаємо лише відмінності від типових для ролі
    defaults = ROLE_DEFAULTS.get(m.role, ROLE_DEFAULTS["master"])
    diff = {k: v for k, v in target.items() if defaults.get(k) != v}
    m.permissions = diff or None

    staff = (await db.execute(select(User).where(User.id == str(staff_id)))).scalars().first()
    who = (staff.full_name if staff and staff.full_name else None) or (staff.email if staff else "працівник")
    changes = []
    if m.role != before_role:
        changes.append(f"{ROLE_LABEL.get(before_role, before_role)} → {ROLE_LABEL.get(m.role, m.role)}")
    after = effective_permissions(m.role, m.permissions)
    for s in SECTIONS:
        if before.get(s) != after.get(s):
            changes.append(f"{SECTION_LABELS[s]}: {'відкрито' if after[s] else 'закрито'}")
    if changes:
        await record(db, business_id, actor_id, "team", "access_changed",
                     f"Доступ для {who}: " + "; ".join(changes),
                     {"staff_id": staff_id, "role": m.role, "sections": after})
    return m


@router.put("/crm/businesses/{business_id}/staff/{staff_id}/access")
async def set_staff_access(
    business_id: int,
    staff_id: str,
    payload: AccessIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Підвищити чи понизити, відкрити чи закрити розділи - лише власник.
    Адміністратор роздавати доступи не може: інакше він міг би підвищити
    сам себе чи когось до власних прав.
    """
    if not await _is_owner(db, business_id, str(current_user.id)):
        raise HTTPException(status_code=403, detail="Змінювати доступи може лише власник")
    if str(staff_id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Власник має всі доступи")
    m = await apply_access(db, business_id, staff_id, str(current_user.id), payload.role, payload.sections)
    await db.commit()
    return {"role": m.role, "sections": effective_permissions(m.role, m.permissions)}


def _audit_filters(biz, owner: bool, date_from, date_to, q):
    """Спільні умови для списку й лічильників: період, пошук і правило видимості."""
    from datetime import time as _time
    from app.core.time_utils import to_utc
    conds = [AuditEvent.business_id == biz.id]
    if not owner:
        # Адміністратор не бачить дій власника
        conds.append(AuditEvent.actor_role != "owner")
    if date_from:
        conds.append(AuditEvent.created_at >= to_utc(datetime.combine(date_from, _time.min), biz))
    if date_to:
        conds.append(AuditEvent.created_at <= to_utc(datetime.combine(date_to, _time.max), biz))
    if q and q.strip():
        like = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        # Текст події або імʼя того, хто діяв: «Олена» знаходить усе, що робила Олена
        conds.append(or_(AuditEvent.summary.ilike(f"%{like}%", escape="\\"),
                         AuditEvent.actor_name.ilike(f"%{like}%", escape="\\")))
    return conds


def _event_out(e: AuditEvent) -> dict:
    return {
        "id": e.id, "category": e.category, "action": e.action, "summary": e.summary, "meta": e.meta,
        "actor_id": e.actor_id, "actor_name": e.actor_name, "actor_role": e.actor_role,
        "created_at": e.created_at.isoformat() + "Z" if e.created_at else None,
    }


@router.get("/crm/businesses/{business_id}/audit")
async def audit_log(
    business_id: int,
    category: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None, max_length=100, description="Пошук у тексті події"),
    date_from: Optional[date] = Query(None, description="З цього дня (за часом закладу)"),
    date_to: Optional[date] = Query(None, description="По цей день включно"),
    before_id: Optional[int] = Query(None, description="Курсор: показати події старіші за цей id"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Журнал дій. Власник бачить усе, адміністратор - без дій власника.
    Майстрові журнал недоступний.

    Сторінки - за курсором (before_id), а не за зсувом: поки людина читає,
    з'являються нові події, і зсув показував би одні й ті самі рядки двічі.
    """
    await assert_business_admin(db, current_user, business_id)
    biz = await db.get(Business, business_id)
    owner = await _is_owner(db, business_id, str(current_user.id))
    conds = _audit_filters(biz, owner, date_from, date_to, q)
    if category in CATEGORIES:
        conds.append(AuditEvent.category == category)
    if actor_id:
        conds.append(AuditEvent.actor_id == actor_id)
    if before_id:
        conds.append(AuditEvent.id < before_id)
    rows = (await db.execute(
        select(AuditEvent).where(*conds).order_by(AuditEvent.id.desc()).limit(limit + 1)
    )).scalars().all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    return {
        "items": [_event_out(e) for e in rows],
        "has_more": has_more,
        "next_before_id": rows[-1].id if rows and has_more else None,
    }


@router.get("/crm/businesses/{business_id}/audit/summary")
async def audit_summary(
    business_id: int,
    q: Optional[str] = Query(None, max_length=100),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Скільки подій за період: загалом, за розділами й за людьми - для фільтрів і бічної колонки."""
    from sqlalchemy import func
    await assert_business_admin(db, current_user, business_id)
    biz = await db.get(Business, business_id)
    owner = await _is_owner(db, business_id, str(current_user.id))
    conds = _audit_filters(biz, owner, date_from, date_to, q)
    by_cat = dict((await db.execute(
        select(AuditEvent.category, func.count(AuditEvent.id)).where(*conds).group_by(AuditEvent.category)
    )).all())
    people = (await db.execute(
        select(AuditEvent.actor_id, func.max(AuditEvent.actor_name), func.max(AuditEvent.actor_role), func.count(AuditEvent.id))
        .where(*conds).group_by(AuditEvent.actor_id).order_by(func.count(AuditEvent.id).desc()).limit(20)
    )).all()
    return {
        "total": sum(by_cat.values()),
        "by_category": {c: by_cat.get(c, 0) for c in CATEGORIES},
        "by_actor": [{"actor_id": a, "name": n, "role": r, "count": c} for a, n, r, c in people],
    }
