"""
Журнал дій закладу.

record() додає подію в поточну транзакцію - вона збережеться разом із
самою дією (тим самим commit). Якщо дія впала й відкотилась, запису в
журналі теж не буде: журнал не бреше про те, чого не сталося.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Dict, Iterable, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import logger


async def actor_info(db: AsyncSession, business_id: int, user_id: Optional[str]):
    """Імʼя й роль того, хто діє, - саме в цьому закладі."""
    from app.models import Business, StaffMembership, User
    if not user_id:
        return None, "client"
    user = (await db.execute(select(User).where(User.id == str(user_id)))).scalars().first()
    name = (user.full_name if user and user.full_name else None) or (user.email.split("@")[0] if user and user.email else None)
    biz = await db.get(Business, business_id)
    if biz and str(biz.owner_id) == str(user_id):
        return name, "owner"
    m = (await db.execute(select(StaffMembership).where(
        StaffMembership.user_id == str(user_id), StaffMembership.business_id == business_id,
    ))).scalars().first()
    if m is not None:
        return name, "owner" if m.role in ("business_owner", "owner") else m.role
    return name, "client"


async def record(db: AsyncSession, business_id: int, actor_id: Optional[str], category: str, action: str,
                 summary: str, meta: Optional[dict] = None) -> None:
    from app.models.master_tools import AuditEvent
    try:
        name, role = await actor_info(db, business_id, actor_id)
        db.add(AuditEvent(business_id=business_id, actor_id=str(actor_id) if actor_id else None,
                          actor_name=name, actor_role=role, category=category, action=action,
                          summary=summary[:500], meta=meta))
    except Exception as exc:
        # Журнал не має ламати саму дію.
        logger.warning("Журнал дій: не вдалося записати %s: %s", action, exc)


# Розділи журналу - одне місце правди: фільтр, лічильники й валідація беруть звідси.
CATEGORIES = ("bookings", "clients", "services", "team", "requests", "money", "inventory", "marketing", "settings")


def _norm(v):
    if isinstance(v, Decimal):
        return round(float(v), 2)
    if isinstance(v, float):
        return round(v, 2)
    if v == "":
        return None
    return v


def _show(v) -> str:
    v = _norm(v)
    if v is None:
        return "—"
    if isinstance(v, bool):
        return "так" if v else "ні"
    if isinstance(v, (date, datetime)):
        return v.strftime("%d.%m.%Y")
    if isinstance(v, float):
        return f"{v:g}"
    if isinstance(v, (list, tuple)):
        return ", ".join(str(x) for x in v) or "—"
    return str(v)


def diff_changes(before: Dict[str, object], after: Dict[str, object], labels: Dict[str, str],
                 hide_values: Iterable[str] = ()) -> List[dict]:
    """
    Що змінилось: [{field, label, from, to}]. Для чутливих полів (нотатки,
    алергії) значень немає - лише факт зміни: в журналі їм не місце.
    """
    hide = set(hide_values)
    out = []
    for field, new in after.items():
        old = before.get(field)
        if _norm(old) == _norm(new):
            continue
        item = {"field": field, "label": labels.get(field, field)}
        if field not in hide:
            item["from"], item["to"] = _show(old), _show(new)
        out.append(item)
    return out


def changes_text(changes: List[dict]) -> str:
    """«Телефон: A → B; Нотатки (змінено)»."""
    return "; ".join(
        f"{c['label']}: {c['from']} → {c['to']}" if "from" in c else f"{c['label']} (змінено)" for c in changes
    )
