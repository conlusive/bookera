"""
Скільки закладів може створити одна людина.

Без обмеження хтось міг би створити тисячі закладів: вони потрапляють у публічний
каталог, займають слаги й підсилюють спам. Ліміт рахується лише за ВЛАСНИМИ
активними закладами (де людина - власник), а не за місцями, де вона працює майстром.

Єдине місце правила: коли з'являться тарифи, достатньо змінити `max_businesses_for`
(наприклад, повертати число залежно від плану підписки власника) - ендпоінти не чіпати.
"""
import os

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Business

DEFAULT_MAX_OWNED_BUSINESSES = 3


def max_businesses_for(user_id: str) -> int:
    """Ліміт закладів для людини. Поки однаковий для всіх; MAX_BUSINESSES_PER_OWNER у .env змінює його."""
    try:
        return max(1, int(os.getenv("MAX_BUSINESSES_PER_OWNER", DEFAULT_MAX_OWNED_BUSINESSES)))
    except ValueError:
        return DEFAULT_MAX_OWNED_BUSINESSES


async def count_owned_businesses(db: AsyncSession, user_id: str) -> int:
    res = await db.execute(
        select(func.count(Business.id)).where(
            Business.owner_id == str(user_id),
            Business.is_active.is_not(False),
        )
    )
    return int(res.scalar() or 0)


def limit_message(limit: int) -> str:
    return f"Досягнуто ліміт закладів: {limit}. Щоб створити ще один, видаліть або деактивуйте непотрібний."
