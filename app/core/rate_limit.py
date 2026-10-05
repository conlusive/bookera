import hmac
import os
import threading
import time
from typing import Dict, Optional, Tuple

from fastapi import HTTPException, Request, status

from app.core.logging_config import logger

REDIS_URL = os.getenv("REDIS_URL", "")

_redis_client = None
_redis_unavailable_logged = False

# Скільки довірених проксі стоїть перед застосунком (Render, Railway, Cloudflare, nginx...).
# 0 - клієнт підключається напряму, тоді IP береться з самого з'єднання. Без цього за проксі
# ВСІ користувачі виглядали б однією адресою: ліміт або блокував би всіх, або не діяв би взагалі.
TRUSTED_PROXY_HOPS = int(os.getenv("TRUSTED_PROXY_HOPS", "0") or 0)


def client_ip(request: Request) -> str:
    """
    IP клієнта. Заголовку X-Forwarded-For довіряємо лише якщо вказано, скільки проксі стоїть
    перед нами (TRUSTED_PROXY_HOPS): беремо адресу, яку дописав найближчий ДОВІРЕНИЙ проксі,
    а не ту, що клієнт міг підставити на початку списку.
    """
    if TRUSTED_PROXY_HOPS > 0:
        forwarded = request.headers.get("x-forwarded-for", "")
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if len(parts) >= TRUSTED_PROXY_HOPS:
            return parts[-TRUSTED_PROXY_HOPS]
    return request.client.host if request.client else "unknown"


def tokens_equal(expected: Optional[str], received: Optional[str]) -> bool:
    """Порівняння секретних токенів за сталий час (щоб довжина збігу не витікала через час відповіді)."""
    if not expected or not received:
        return False
    return hmac.compare_digest(str(expected).encode(), str(received).encode())


def _get_redis():
    """
    Лінива ініціалізація - якщо REDIS_URL не задано або Redis впав, працює лічильник у пам'яті
    процесу (див. нижче), а НЕ валить весь бекенд.
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
                logger.warning(f"Redis недоступний, використовую лічильник у пам'яті: {e}")
                _redis_unavailable_logged = True
            return None
    return _redis_client


# --- Резервний лічильник у пам'яті ------------------------------------------------------------
# Без Redis ліміти раніше мовчки вимикались - тобто захисту від спаму не було зовсім. Лічильник у
# пам'яті діє в межах одного процесу (для одного інстансу цього достатньо; для кількох - потрібен Redis).
_mem: Dict[str, Tuple[int, float]] = {}
_mem_lock = threading.Lock()
_MEM_MAX_KEYS = 50_000


def _mem_hit(key: str, window_seconds: int) -> int:
    now = time.monotonic()
    with _mem_lock:
        count, reset_at = _mem.get(key, (0, 0.0))
        if now >= reset_at:
            count, reset_at = 0, now + window_seconds
        count += 1
        _mem[key] = (count, reset_at)
        if len(_mem) > _MEM_MAX_KEYS:  # не росте безкінечно: прибираємо прострочені
            for k in [k for k, (_, r) in _mem.items() if now >= r]:
                _mem.pop(k, None)
        return count


def _bypass() -> bool:
    """У тестах лімітів немає (їх перевіряє окремий тест, що вмикає лічильник явно)."""
    return bool(os.getenv("PYTEST_CURRENT_TEST")) and not os.getenv("RATE_LIMIT_IN_TESTS")


def rate_limit(key_prefix: str, max_requests: int, window_seconds: int):
    """
    Фабрика FastAPI-залежностей: rate_limit("lock", 20, 60) -> не більше
    20 запитів за 60 секунд з однієї IP на цей ендпоінт.

    Redis (INCR + EXPIRE, фіксоване вікно), а коли його немає - лічильник у пам'яті процесу.
    """
    async def _dependency(request: Request):
        if _bypass():
            return
        ip = client_ip(request)
        key = f"ratelimit:{key_prefix}:{ip}"

        count: Optional[int] = None
        client = _get_redis()
        if client is not None:
            try:
                count = await client.incr(key)
                if count == 1:
                    await client.expire(key, window_seconds)
            except Exception as e:
                # Помилка самого Redis (не ліміт) - не блокуємо користувача, а рахуємо в пам'яті
                logger.warning(f"Rate limiter: помилка Redis, рахую в пам'яті: {e}")
                count = None
        if count is None:
            count = _mem_hit(key, window_seconds)

        if count > max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Забагато запитів, спробуйте трохи пізніше",
            )

    return _dependency
