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
import re
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


# Скорочення типів вулиць. OpenStreetMap знає «вулиця Городоцька»,
# а «вул.» чи «просп.» часто не розпізнає - і не знаходить будинок.
_STREET_TYPES = {
    "вул": "вулиця", "вулиця": "вулиця",
    "просп": "проспект", "пр-т": "проспект", "проспект": "проспект",
    "пл": "площа", "площа": "площа",
    "бульв": "бульвар", "б-р": "бульвар", "бульвар": "бульвар",
    "пров": "провулок", "провулок": "провулок",
    "наб": "набережна", "набережна": "набережна",
    "шосе": "шосе", "узвіз": "узвіз",
}
# Частини адреси, що заважають знайти будинок: офіс, квартира, поверх,
# торговий центр, вхід. Лишаємо вулицю й номер.
_NOISE = re.compile(
    # Лише разом із НОМЕРОМ: «під» саме по собі - частина назв вулиць
    # («Під Дубом», «Під Голоском» у Львові), і прибирати його не можна.
    r"(,?\s*(оф|офіс|кв|квартира|прим|приміщення|пов|поверх|підʼїзд|під'їзд|вхід|секція|корп|корпус|каб|кабінет)\.?\s*№?\s*\d[\w/-]*)"
    r"|(,?\s*\d+\s*(поверх|пов\.?))"
    r"|(,?\s*(тц|трц|бц|жк)\s+[«\"]?[^,]+[»\"]?)",
    re.IGNORECASE,
)


def clean_address(address: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """
    Прибрати з адреси все, що заважає пошуку, і розкласти на вулицю
    та номер будинку.

    «вул. Городоцька, 45, оф. 12» -> ("вулиця Городоцька", "45")
    «просп. Свободи 28А»          -> ("проспект Свободи", "28А")
    """
    if not address:
        return None, None
    text = _NOISE.sub("", address).strip(" ,")

    # Тип вулиці на початку: «вул.», «просп» тощо -> повна назва.
    m = re.match(r"^\s*([А-Яа-яІіЇїЄєҐґ'ʼ-]+)\.?\s+(.*)$", text)
    if m and m.group(1).lower().rstrip(".") in _STREET_TYPES:
        text = f"{_STREET_TYPES[m.group(1).lower().rstrip('.')]} {m.group(2)}"

    # Номер будинку - останнє число (з буквою чи дробом) у рядку.
    num = re.search(r"(\d+[А-Яа-яA-Za-z]?(?:/\d+[А-Яа-яA-Za-z]?)?)\s*$", text.replace(",", " ").strip())
    house = num.group(1) if num else None
    street = text[: num.start()].strip(" ,") if num else text
    return (street or None), house


async def _nominatim(params: dict) -> Optional[Tuple[float, float]]:
    """Один запит до Nominatim із дотриманням ліміту 1 запит/с."""
    global _last_request_at
    async with _rate_limit:
        now = asyncio.get_event_loop().time()
        wait = 1.0 - (now - _last_request_at)
        if wait > 0:
            await asyncio.sleep(wait)
        _last_request_at = asyncio.get_event_loop().time()

        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.get(
                NOMINATIM_URL,
                params={**params, "format": "json", "limit": 1,
                        # Обмежуємо Україною: «Лесі Українки 5» є в
                        # десятку країн.
                        "countrycodes": "ua"},
                headers={"User-Agent": USER_AGENT, "Accept-Language": "uk"},
            )
    if response.status_code != 200:
        logger.warning("Геокодування: сервіс відповів %s", response.status_code)
        return None
    results = response.json()
    if not results:
        return None
    return float(results[0]["lat"]), float(results[0]["lon"])


async def geocode_address(
    city: Optional[str],
    address: Optional[str],
    country: str = "Україна",
) -> Optional[Tuple[float, float]]:
    """
    Знайти координати за адресою - кількома спробами, від точної до
    загальної. Перша, що знайшла, - перемагає.

      1. Структурований пошук: вулиця + номер + місто окремими полями.
         Найточніший - OpenStreetMap не плутає номер будинку з назвою.
      2. Очищена адреса одним рядком (без «оф. 12», «ТЦ ...», з
         розгорнутим «вул.»).
      3. Адреса як є - на випадок, якщо очищення щось зіпсувало.

    Раніше була лише третя спроба: адреси на кшталт «вул. Городоцька,
    45, оф. 12» не знаходились, і власник бачив «Не вдалося знайти».

    None - НЕ помилка: будинку може ще не бути в OpenStreetMap. Тоді
    власник ставить мітку вручну.
    """
    if not (address and address.strip()) or not (city and city.strip()):
        # Без вулиці чи міста знайдеться хіба центр міста чи країни -
        # точка, що вводить в оману гірше за її відсутність.
        return None

    street, house = clean_address(address)
    attempts = []
    if street:
        attempts.append({"street": f"{house} {street}".strip() if house else street,
                         "city": city.strip(), "country": country})
    cleaned = ", ".join(x for x in [f"{street} {house or ''}".strip() if street else None, city.strip(), country] if x)
    attempts.append({"q": cleaned})
    original = ", ".join(p.strip() for p in (address, city, country) if p and p.strip())
    if original != cleaned:
        attempts.append({"q": original})

    for params in attempts:
        try:
            found = await _nominatim(params)
        except Exception as exc:
            # Збій мережі - не привід ламати збереження закладу.
            logger.warning("Геокодування не вдалося (%s): %s", params, exc)
            return None
        if found:
            return found
    return None
