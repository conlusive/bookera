"""
Профіль закладу: як тип бізнесу впливає на його поведінку.

Дані з реєстрації (тип, спосіб роботи, категорія) досі просто лежали
в базі й ні на що не впливали: приватний майстер удома отримував ті
самі налаштування, що й салон на десять крісел.

Тут зібрано рішення, які з цих даних випливають. Свідомо в одному
місці, а не розкидано по ендпоінтах: коли профіль впливає на п'ять
різних речей, ці правила треба читати разом, інакше вони розʼїдуться.
"""
from typing import Any, Dict

# Типовий крок сітки і тривалість візиту за категоріями.
#
# Числа не з голови: барбер стриже за 30-45 хвилин і ставить кілька
# людей на годину, майстер манікюру працює 1.5-2 години на клієнта.
# Спільна сітка на 30 хвилин змушує одних дробити день, а інших -
# гортати порожні слоти.
CATEGORY_DEFAULTS: Dict[str, Dict[str, Any]] = {
    "barber":   {"time_step": 30, "default_duration": 45, "min_advance_hours": 1},
    "nails":    {"time_step": 30, "default_duration": 90, "min_advance_hours": 3},
    "hair":     {"time_step": 30, "default_duration": 90, "min_advance_hours": 3},
    "beauty":   {"time_step": 30, "default_duration": 60, "min_advance_hours": 2},
    "brows":    {"time_step": 15, "default_duration": 45, "min_advance_hours": 2},
    "massage":  {"time_step": 30, "default_duration": 60, "min_advance_hours": 3},
    "spa":      {"time_step": 30, "default_duration": 90, "min_advance_hours": 4},
}

_FALLBACK = {"time_step": 30, "default_duration": 60, "min_advance_hours": 2}


def default_booking_settings(category: str | None, business_type: str | None,
                             workspace_type: str | None) -> Dict[str, Any]:
    """
    Початкові правила бронювання для новоствореного закладу.

    Раніше всі отримували однакові значення, і власник мусив сам
    здогадуватись, що для манікюру крок у 30 хвилин незручний.
    """
    base = dict(CATEGORY_DEFAULTS.get((category or "").lower(), _FALLBACK))

    settings: Dict[str, Any] = {
        "is_active": True,
        "is_paused_emergency": False,
        "time_step": base["time_step"],
        "min_advance_hours": base["min_advance_hours"],
        "max_advance_days": 60,
        # Тривалість візиту за замовчуванням - підставляється при
        # створенні нової послуги, щоб не вводити щоразу вручну.
        "default_duration": base["default_duration"],
        # Буфер після візиту: прибрати, підготувати місце, помити руки.
        # Саме через невраховані 10-15 хвилин майстри й спізнюються -
        # календар обіцяє час, якого фізично немає.
        "buffer_minutes": 10 if category in ("nails", "hair", "spa", "massage") else 5,
        "cancellation_policy": "Скасування можливе не пізніше ніж за 24 години до візиту.",
    }

    # Виїзд до клієнта: майстру потрібен час на дорогу, тому запис
    # «через годину» нереалістичний навіть для барбера.
    if workspace_type == "client_place":
        settings["min_advance_hours"] = max(settings["min_advance_hours"], 4)
        settings["cancellation_policy"] = (
            "Скасування можливе не пізніше ніж за 24 години до візиту. "
            "Майстер виїжджає за вказаною вами адресою."
        )

    # Приватний майстер планує далі наперед: у нього менше слотів,
    # і постійні клієнти записуються на місяці вперед.
    if business_type == "individual":
        settings["max_advance_days"] = 90

    return settings


def is_solo_business(business) -> bool:
    """
    Чи це майстер-одинак.

    Впливає на те, які частини CRM показувати: керування командою,
    виплати майстрам і колонки в календарі не мають сенсу, поки
    людина працює сама.

    Перевіряємо і тип, і фактичну кількість людей: тип обирають один
    раз при реєстрації, а команда може зʼявитись пізніше - і тоді
    ховати вкладку вже неправильно.
    """
    return business.business_type == "individual"
