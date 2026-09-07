"""
Підписка закладу: що дає тариф і як перевіряти доступ.

Правила зібрані в одному місці навмисно. Коли обмеження розкидані по
ендпоінтах, змінити тариф означає обійти десяток файлів і щось
неодмінно пропустити - а пропущена перевірка в платній функції
помічається не одразу.
"""
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status

from app.core.time_utils import utc_now

PLAN_FREE = "free"
PLAN_PRO = "pro"


# Межі безкоштовного тарифу.
#
# Логіка добору: безкоштовний план має бути придатним для роботи
# майстра-одинака, інакше людина не встигне побачити користь і піде.
# Обмежуємо те, що потрібне саме СТРУКТУРАМ - команда, склад, аналітика -
# а не щоденну роботу з клієнтами.
FREE_LIMITS = {
    "max_staff": 1,          # лише сам власник
    "max_services": 10,
    "max_active_clients": 50,
}

# Що недоступне без підписки.
#
# Календар, клієнти й послуги не включені свідомо: якщо забрати
# щоденну роботу, продуктом неможливо користуватись, і безкоштовний
# тариф перетворюється на демонстрацію.
PRO_ONLY_FEATURES = {
    "inventory": "Склад і витрати",
    "analytics": "Аналітика",
    "marketing": "Маркетинг і розсилки",
    "payouts": "Виплати майстрам",
    "storefront_custom": "Налаштування онлайн-вітрини",
}


def is_subscription_active(business) -> bool:
    """
    Чи діє платна підписка.

    subscription_until = NULL при тарифі 'pro' означає безстроковий
    доступ: так адміністратор платформи видає доступ партнеру або на
    час тестування, не вигадуючи дату «до 2099 року».
    """
    if business is None:
        return False
    if business.subscription_plan != PLAN_PRO:
        return False
    if business.subscription_until is None:
        return True
    return business.subscription_until > utc_now()


def assert_pro_feature(business, feature: str) -> None:
    """
    Перевірка доступу до платної можливості.

    Формулювання відмови називає, ЩО саме недоступне: «недостатньо
    прав» у відповідь на клік по «Аналітиці» лишає людину гадати,
    чи це помилка, чи вона чогось не купила.
    """
    if is_subscription_active(business):
        return

    label = PRO_ONLY_FEATURES.get(feature, feature)
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail=f"«{label}» доступна за підпискою Pro",
    )


def subscription_state(business) -> dict:
    """Стан підписки для інтерфейсу - щоб CRM показувала правду."""
    active = is_subscription_active(business)
    return {
        "plan": business.subscription_plan if business else PLAN_FREE,
        "is_active": active,
        "until": business.subscription_until if business else None,
        "limits": None if active else FREE_LIMITS,
        "pro_features": list(PRO_ONLY_FEATURES.values()),
    }


def assert_platform_admin(user) -> None:
    """
    Доступ до адміністрування платформи.

    Окрема перевірка, а не роль у закладі: роль описує місце людини
    в конкретному салоні, а це - рівень усього сервісу. Прапорець
    ставиться лише вручну в базі, самопризначення неприпустиме.
    """
    if not user or not getattr(user, "is_platform_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ лише для адміністраторів платформи",
        )
