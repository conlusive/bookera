"""
Розсилки клієнтам закладу: відписки, добові ліміти, адреси.

Відписка працює за ПІДПИСАНИМ токеном (HMAC), а не за записом у базі: посилання з листа має
діяти без входу в акаунт і не вгадуватись. Токен містить заклад і пошту, тож відписати чужу
пошту, не знаючи посилання, неможливо.
"""
import base64
import hashlib
import hmac
import json
import os
import re
from datetime import timedelta
from typing import Iterable, Optional, Set, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time_utils import utc_now
from app.models import EmailCampaign, EmailSuppression

# Скільки листів на добу може піти з одного закладу і скільки розсилок. Без цього один власник
# міг би розіслати тисячі листів від імені платформи (спам і блокування пошти для всіх).
DAILY_RECIPIENT_LIMIT = int(os.getenv("CAMPAIGN_DAILY_RECIPIENTS", "500") or 500)
DAILY_CAMPAIGN_LIMIT = int(os.getenv("CAMPAIGN_DAILY_COUNT", "3") or 3)

_EMAIL_RE = re.compile(r"^[^@\s<>\"',;]+@[^@\s<>\"',;]+\.[^@\s<>\"',;]{2,}$")


def normalize_email(email: Optional[str]) -> str:
    return (email or "").strip().lower()


def is_valid_email(email: Optional[str]) -> bool:
    e = normalize_email(email)
    return bool(e) and len(e) <= 254 and bool(_EMAIL_RE.match(e))


# --- Підписаний токен відписки ---------------------------------------------------------------

def _secret() -> bytes:
    """
    Окремий UNSUBSCRIBE_SECRET, а коли його немає - похідний від секрету токенів чи адреси бази
    (стабільні між перезапусками: посилання зі старих листів мають і далі працювати).
    """
    raw = (
        os.getenv("UNSUBSCRIBE_SECRET")
        or os.getenv("SUPABASE_JWT_SECRET")
        or os.getenv("DATABASE_URL")
        or "bookera-dev-unsubscribe"
    )
    return hashlib.sha256(("unsubscribe:" + raw).encode()).digest()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def make_unsubscribe_token(business_id: int, email: str) -> str:
    payload = _b64(json.dumps({"b": int(business_id), "e": normalize_email(email)}, separators=(",", ":")).encode())
    sig = _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def parse_unsubscribe_token(token: str) -> Optional[Tuple[int, str]]:
    """(заклад, пошта), якщо підпис справжній; інакше None."""
    try:
        payload, sig = (token or "").split(".", 1)
        expected = _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, sig):
            return None
        data = json.loads(_unb64(payload))
        email = normalize_email(data.get("e"))
        return int(data["b"]), email if email else None  # type: ignore[return-value]
    except Exception:
        return None


def frontend_unsubscribe_url(token: str) -> str:
    base = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    return f"{base}/unsubscribe?token={token}"


def one_click_unsubscribe_url(token: str) -> str:
    """Адреса, на яку поштовий клієнт сам надсилає POST (RFC 8058). Порожньо, якщо публічна адреса API не задана."""
    base = os.getenv("BACKEND_PUBLIC_URL", "").rstrip("/")
    return f"{base}/public/unsubscribe/{token}" if base else ""


# --- База ---------------------------------------------------------------------------------------

async def suppressed_emails(db: AsyncSession, business_id: int) -> Set[str]:
    rows = await db.execute(select(EmailSuppression.email).where(EmailSuppression.business_id == business_id))
    return {r[0] for r in rows.all()}


async def unsubscribe(db: AsyncSession, business_id: int, email: str, source: str = "unsubscribe") -> bool:
    """Додає пошту до списку відписаних. True - нова відписка, False - вже була (повтор безпечний)."""
    email = normalize_email(email)
    exists = (await db.execute(
        select(EmailSuppression.id).where(EmailSuppression.business_id == business_id, EmailSuppression.email == email)
    )).first()
    if exists:
        return False
    db.add(EmailSuppression(business_id=business_id, email=email, source=source))
    await db.commit()
    return True


async def resubscribe(db: AsyncSession, business_id: int, email: str) -> bool:
    email = normalize_email(email)
    row = (await db.execute(
        select(EmailSuppression).where(EmailSuppression.business_id == business_id, EmailSuppression.email == email)
    )).scalars().first()
    if not row:
        return False
    await db.delete(row)
    await db.commit()
    return True


async def quota(db: AsyncSession, business_id: int) -> dict:
    """Скільки листів і розсилок уже було за останню добу й скільки ще можна."""
    since = utc_now() - timedelta(days=1)
    used_recipients, used_campaigns = (await db.execute(
        select(func.coalesce(func.sum(EmailCampaign.recipients), 0), func.count(EmailCampaign.id)).where(
            EmailCampaign.business_id == business_id, EmailCampaign.created_at > since,
        )
    )).one()
    used_recipients, used_campaigns = int(used_recipients or 0), int(used_campaigns or 0)
    return {
        "daily_recipient_limit": DAILY_RECIPIENT_LIMIT,
        "daily_campaign_limit": DAILY_CAMPAIGN_LIMIT,
        "used_recipients": used_recipients,
        "used_campaigns": used_campaigns,
        "remaining_recipients": max(0, DAILY_RECIPIENT_LIMIT - used_recipients),
        "remaining_campaigns": max(0, DAILY_CAMPAIGN_LIMIT - used_campaigns),
    }


def unique_recipients(clients: Iterable, blocked: Set[str]):
    """
    Унікальні адреси: одна пошта в кількох картках клієнта не повинна отримати лист двічі.
    Пропускаємо відписаних і некоректні адреси. Повертає (список, скільки відписаних, скільки некоректних).
    """
    seen: Set[str] = set()
    out, unsub, invalid = [], 0, 0
    for c in clients:
        e = normalize_email(getattr(c, "email", None))
        if not e or e in seen:
            continue
        if e in blocked:
            unsub += 1
            seen.add(e)
            continue
        if not is_valid_email(e):
            invalid += 1
            seen.add(e)
            continue
        seen.add(e)
        out.append((c, e))
    return out, unsub, invalid


async def run_campaign(campaign_id: int, items: list, business_name: str, subject: str, message: str, reply_to: str = "") -> None:
    """
    Фонова відправка розсилки: будує листи, шле пакетом, записує результат у журнал розсилок.
    Працює у власній сесії бази: сесія запиту до цього часу вже закрита.
    """
    import asyncio

    from app.core.database import AsyncSessionLocal
    from app.core.email import build_campaign_message, send_campaign_batch
    from app.core.logging_config import logger

    async def _update(**fields):
        async with AsyncSessionLocal() as db:
            row = await db.get(EmailCampaign, campaign_id)
            if row:
                for k, v in fields.items():
                    setattr(row, k, v)
                await db.commit()

    try:
        await _update(status="sending")
        messages = [
            build_campaign_message(
                to_email=email, client_name=name, business_name=business_name, subject=subject, message=message,
                unsubscribe_url=frontend_unsubscribe_url(token), one_click_url=one_click_unsubscribe_url(token),
                reply_to=reply_to,
            )
            for email, name, token in items
        ]
        sent, failed = await asyncio.to_thread(send_campaign_batch, messages)
        await _update(status="done", sent=sent, failed=failed, finished_at=utc_now())
    except Exception as exc:  # збій не повинен лишити розсилку «вічно в процесі»
        logger.error("Розсилка %s: збій відправки: %r", campaign_id, exc, exc_info=True)
        try:
            await _update(status="done", failed=len(items), finished_at=utc_now())
        except Exception:
            pass
