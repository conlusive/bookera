import os
from typing import Optional

from fastapi import HTTPException, Request, status

from app.core.logging_config import logger

REDIS_URL = os.getenv("REDIS_URL", "")

_redis_client = None
_redis_unavailable_logged = False


def _get_redis():
    """
    Лінива ініціалізація - якщо REDIS_URL не задано або Redis впав,
    rate limiting просто вимикається (лог один раз), а НЕ валить весь бекенд.
    Захист від зловживань важливий, але недоступність booking-флоу через
    відсутній Redis - значно гірший сценарій.
    """
    global _redis_client, _redis_unavailable_logged
    if not REDIS_URL:
        return None
    if _redis_client is None:
        try:
            import redis.asyncio as redis
            _redis_client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1)
        except Exception as e:
            if not _redis_unavailable_logged:
                logger.warning(f"Redis недоступний, rate limiting вимкнено: {e}")
                _redis_unavailable_logged = True
            return None
    return _redis_client


def rate_limit(key_prefix: str, max_requests: int, window_seconds: int):
    """
    Фабрика FastAPI-залежностей: rate_limit("lock", 20, 60) -> не більше
    20 запитів за 60 секунд з однієї IP на цей ендпоінт.

    Використовує фіксоване вікно через Redis INCR + EXPIRE - просто і
    достатньо для захисту від спаму/DoS, не потребує зовнішніх бібліотек.
    """
    async def _dependency(request: Request):
        client = _get_redis()
        if client is None:
            return  # Redis не налаштований/недоступний - пропускаємо без помилки

        ip = request.client.host if request.client else "unknown"
        key = f"ratelimit:{key_prefix}:{ip}"
        try:
            count = await client.incr(key)
            if count == 1:
                await client.expire(key, window_seconds)
            if count > max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Забагато запитів, спробуйте трохи пізніше",
                )
        except HTTPException:
            raise
        except Exception as e:
            # Помилка самого Redis (не ліміт) - не блокуємо користувача через це
            logger.warning(f"Rate limiter: помилка Redis, пропускаю перевірку: {e}")

    return _dependency
