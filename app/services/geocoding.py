"""
Перетворення адреси на координати.

Заклад вводить адресу — ми самі знаходимо точку. Мапа лишається
як страховка: показуємо її, тільки якщо автоматично не вийшло або
власник хоче уточнити вхід.

Nominatim (OpenStreetMap), а не Google Geocoding: безкоштовно й без
ключа. Ціна — обмеження в один запит на секунду й вимога чесно
представлятися в User-Agent.
"""
import asyncio
from typing import Optional, Tuple

import httpx

from app.core.logging_config import logger

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# Nominatim вимагає User-Agent із контактом - інакше блокує за
# зловживання. Це їхнє правило, не наша примха.
USER_AGENT = "Bookera/1.0 (https://bookera.com.ua)"

# Один запит на секунду - обмеження Nominatim. Тримаємо замок на
# рівні процесу: паралельні реєстрації не мають перевищити ліміт
# і отримати бан на весь сервіс.
_rate_limit = asyncio.Lock()
_last_request_at = 0.0


async def geocode_address(
    city: Optional[str],
    address: Optional[str],
    country: str = "Україна",
) -> Optional[Tuple[float, float]]:
    """
    Знайти координати за адресою.

    Повертає (широта, довгота) або None, якщо не знайдено.

    None - НЕ помилка: адреса може бути новобудовою, якої ще немає
    в OpenStreetMap, або записаною нестандартно. Тоді власник ставить
    мітку вручну, і це нормальний шлях, а не аварійний.
    """
    parts = [p.strip() for p in (address, city, country) if p and p.strip()]
    if len(parts) < 2:
        # Сама лише країна нічого не дасть - повернеться центр України.
        return None

    query = ", ".join(parts)

    global _last_request_at
    async with _rate_limit:
        now = asyncio.get_event_loop().time()
        wait = 1.0 - (now - _last_request_at)
        if wait > 0:
            await asyncio.sleep(wait)
        _last_request_at = asyncio.get_event_loop().time()

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                response = await client.get(
                    NOMINATIM_URL,
                    params={
                        "q": query,
                        "format": "json",
                        "limit": 1,
                        # Обмежуємо Україною: «Лесі Українки 5» є
                        # в десятку країн, і без цього можна отримати
                        # точку в Казахстані.
                        "countrycodes": "ua",
                    },
                    headers={"User-Agent": USER_AGENT},
                )

            if response.status_code != 200:
                logger.warning("Геокодування: сервіс відповів %s", response.status_code)
                return None

            results = response.json()
            if not results:
                return None

            return float(results[0]["lat"]), float(results[0]["lon"])

        except Exception as exc:
            # Геокодування не має ламати збереження закладу: без
            # координат він просто не потрапить у пошук «поблизу»,
            # а решта працюватиме.
            logger.warning("Геокодування не вдалося (%s): %s", query, exc)
            return None
