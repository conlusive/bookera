"""
Відстань по дорогах.

Відстань по прямій дає помилку до 40%: дорога йде в обхід кварталів,
річок і залізниць. Для «що поруч» це важливо — заклад за 800 метрів
по прямій може бути за два кілометри пішки, якщо між вами колія.

OSRM (Open Source Routing Machine) — безкоштовний і без ключа.
Публічний сервер має обмеження на частоту, тому:
  - питаємо ОДНИМ запитом про всі заклади одразу (table service)
  - кешуємо результат
  - при збої тихо повертаємось до прямої відстані

Для продакшну варто підняти власний OSRM або взяти OpenRouteService
із ключем: публічний сервер не дає жодних гарантій доступності.
"""
import asyncio
import math
import os
from typing import Dict, List, Optional, Tuple

import httpx

from app.core.logging_config import logger

# Адресу можна перевизначити через змінну оточення - для власного
# сервера OSRM, коли публічного стане замало.
OSRM_URL = os.getenv("OSRM_URL", "https://router.project-osrm.org")

# Скільки точок питаємо за раз. OSRM обмежує розмір таблиці, і
# сто закладів одним запитом він відхилить.
MAX_DESTINATIONS = 50

# Кеш: ключ - округлені координати людини й заклад.
#
# Округлення до 3 знаків (~110 метрів) свідоме: людина, яка
# пройшла півсотні метрів, отримає ту саму відповідь із кешу
# замість нового запиту. Різниця в маршруті на такій відстані
# все одно менша за похибку самого маршрутизатора.
_cache: Dict[str, float] = {}
_cache_lock = asyncio.Lock()

CACHE_LIMIT = 10000


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Відстань по прямій - запасний варіант і основа для сортування."""
    r_lat1, r_lon1 = math.radians(lat1), math.radians(lon1)
    r_lat2, r_lon2 = math.radians(lat2), math.radians(lon2)
    dlat, dlon = r_lat2 - r_lat1, r_lon2 - r_lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(r_lat1) * math.cos(r_lat2) * math.sin(dlon / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(a))


def _cache_key(lat: float, lng: float, dest_lat: float, dest_lng: float) -> str:
    return f"{lat:.3f},{lng:.3f}->{dest_lat:.4f},{dest_lng:.4f}"


async def road_distances_km(
    from_lat: float,
    from_lng: float,
    destinations: List[Tuple[int, float, float]],
) -> Dict[int, float]:
    """
    Відстані по дорогах від точки людини до кожного закладу.

    destinations: список (id, широта, довгота).
    Повертає {id: кілометри}. Заклади, для яких маршрут не знайшовся,
    у відповідь не потрапляють - викликач вирішує, що з ними робити.
    """
    if not destinations:
        return {}

    result: Dict[int, float] = {}
    to_fetch: List[Tuple[int, float, float]] = []

    async with _cache_lock:
        for biz_id, lat, lng in destinations:
            cached = _cache.get(_cache_key(from_lat, from_lng, lat, lng))
            if cached is not None:
                result[biz_id] = cached
            else:
                to_fetch.append((biz_id, lat, lng))

    if not to_fetch:
        return result

    # Ріжемо на порції: OSRM відхиляє надто великі таблиці.
    for start in range(0, len(to_fetch), MAX_DESTINATIONS):
        chunk = to_fetch[start:start + MAX_DESTINATIONS]

        # OSRM чекає координати як «довгота,широта» - саме в такому
        # порядку, протилежному до звичного.
        coords = ";".join(
            [f"{from_lng},{from_lat}"] + [f"{lng},{lat}" for _, lat, lng in chunk]
        )
        # sources=0 - рахуємо від першої точки (людини) до решти.
        url = f"{OSRM_URL}/table/v1/driving/{coords}?sources=0&annotations=distance"

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(url)

            if response.status_code != 200:
                logger.warning("OSRM відповів %s", response.status_code)
                continue

            data = response.json()
            distances = (data.get("distances") or [[]])[0]

            # Перший елемент - відстань до себе (нуль), решта - до закладів.
            async with _cache_lock:
                for i, (biz_id, lat, lng) in enumerate(chunk, start=1):
                    if i >= len(distances):
                        break
                    meters = distances[i]
                    if meters is None:
                        # Маршруту немає - буває для точок на островах
                        # або посеред води через помилку в координатах.
                        continue

                    km = meters / 1000.0
                    result[biz_id] = km

                    # Простий захист від нескінченного росту: коли кеш
                    # переповнився, чистимо повністю. Складніше витіснення
                    # тут не варте ускладнення - дані дешеві й швидко
                    # набираються знову.
                    if len(_cache) >= CACHE_LIMIT:
                        _cache.clear()
                    _cache[_cache_key(from_lat, from_lng, lat, lng)] = km

        except Exception as exc:
            # Маршрутизатор недоступний - не біда: викликач візьме
            # пряму відстань. Показати приблизне краще, ніж нічого.
            logger.warning("OSRM недоступний: %s", exc)
            continue

    return result
