"""
Журнал дій закладу.

record() додає подію в поточну транзакцію - вона збережеться разом із
самою дією (тим самим commit). Якщо дія впала й відкотилась, запису в
журналі теж не буде: журнал не бреше про те, чого не сталося.
"""
from typing import Optional

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
