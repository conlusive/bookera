"""
Відписка від розсилок закладу - без входу в акаунт, за підписаним токеном із листа.

POST працює й для «відписки в один клік» (RFC 8058): Gmail/Yahoo самі надсилають на адресу з
заголовка List-Unsubscribe POST із тілом List-Unsubscribe=One-Click - тіло ми не читаємо.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.rate_limit import rate_limit
from app.models import Business, EmailSuppression
from app.services import mailing

router = APIRouter(prefix="/public/unsubscribe", tags=["Unsubscribe"])

_limit = Depends(rate_limit("unsubscribe", max_requests=30, window_seconds=600))


def _mask(email: str) -> str:
    name, _, domain = email.partition("@")
    return f"{name[:1]}{'*' * max(2, len(name) - 1)}@{domain}"


async def _resolve(db: AsyncSession, token: str):
    parsed = mailing.parse_unsubscribe_token(token)
    if not parsed or not parsed[1]:
        # Однакова відповідь для будь-якого збою: підроблений токен нічого не розкриває
        raise HTTPException(status_code=404, detail="Посилання недійсне або застаріло")
    business_id, email = parsed
    business = (await db.execute(select(Business).where(Business.id == business_id))).scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Посилання недійсне або застаріло")
    return business, email


@router.get("/{token}")
async def unsubscribe_info(token: str, db: AsyncSession = Depends(get_db), _rl=_limit):
    business, email = await _resolve(db, token)
    already = (await db.execute(
        select(EmailSuppression.id).where(EmailSuppression.business_id == business.id, EmailSuppression.email == email)
    )).first() is not None
    return {"business_name": business.name, "email": _mask(email), "unsubscribed": already}


@router.post("/{token}")
async def unsubscribe_now(token: str, db: AsyncSession = Depends(get_db), _rl=_limit):
    business, email = await _resolve(db, token)
    await mailing.unsubscribe(db, business.id, email)
    return {"status": "unsubscribed", "unsubscribed": True, "business_name": business.name, "email": _mask(email)}


@router.post("/{token}/resubscribe")
async def resubscribe_now(token: str, db: AsyncSession = Depends(get_db), _rl=_limit):
    business, email = await _resolve(db, token)
    await mailing.resubscribe(db, business.id, email)
    return {"status": "subscribed", "unsubscribed": False, "business_name": business.name, "email": _mask(email)}
