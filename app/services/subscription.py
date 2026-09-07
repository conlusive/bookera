"""
Підписка: один тариф, доступ лише платний.

Безкоштовного рівня немає. Але новий заклад отримує пробний період -
інакше людина не може навіть подивитись, за що платить, і реєстрація
перетворюється на сліпу покупку. Це не «безкоштовний тариф»: пробний
період спливає й не поновлюється.

Правила зібрані в одному місці навмисно. Коли перевірка доступу
розкидана по ендпоінтах, зміна умов означає обійти десяток файлів
і щось неодмінно пропустити - а пропущена перевірка в платному
продукті помічається не одразу.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status

from app.core.time_utils import utc_now

TRIAL_DAYS = 14

# Стани, у яких заклад може перебувати:
#   'trial'   - пробний період після реєстрації
#   'active'  - оплачена підписка
#   'expired' - усе скінчилось, доступ закритий
STATUS_TRIAL = "trial"
STATUS_ACTIVE = "active"
STATUS_EXPIRED = "expired"


def trial_until() -> datetime:
    """Дата завершення пробного періоду для новоствореного закладу."""
    return utc_now() + timedelta(days=TRIAL_DAYS)


def subscription_status(business) -> str:
    """
    Поточний стан підписки.

    subscription_until = NULL при активній підписці означає безстроковий
    доступ - так адміністратор платформи видає доступ партнеру, не
    вигадуючи дату «до 2099 року».
    """
    if business is None:
        return STATUS_EXPIRED

    plan = getattr(business, "subscription_plan", None)
    until = getattr(business, "subscription_until", None)

    if plan == STATUS_ACTIVE:
        return STATUS_ACTIVE if (until is None or until > utc_now()) else STATUS_EXPIRED

    if plan == STATUS_TRIAL:
        return STATUS_TRIAL if (until and until > utc_now()) else STATUS_EXPIRED

    return STATUS_EXPIRED


def has_access(business) -> bool:
    """Чи має заклад доступ до CRM просто зараз."""
    return subscription_status(business) in (STATUS_TRIAL, STATUS_ACTIVE)


def assert_has_access(business) -> None:
    """
    Перевірка доступу до платної частини.

    Код 402, а не 403: інтерфейс має відрізняти «вам не можна» від
    «треба оплатити» - це різні екрани й різні дії людини.

    Формулювання називає причину прямо. «Недостатньо прав» у відповідь
    на відкриття власного ж кабінету лишає людину гадати, що зламалось.
    """
    state = subscription_status(business)
    if state in (STATUS_TRIAL, STATUS_ACTIVE):
        return

    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail="Термін підписки завершився. Продовжіть її, щоб користуватись кабінетом.",
    )


def subscription_state(business) -> dict:
    """
    Стан підписки для інтерфейсу.

    days_left рахуємо тут, а не на фронтенді: дата на пристрої людини
    може бути будь-якою, і «залишився 1 день» не повинен залежати від
    годинника її ноутбука.
    """
    state = subscription_status(business)
    until = getattr(business, "subscription_until", None) if business else None

    days_left: Optional[int] = None
    if until:
        delta = until - utc_now()
        days_left = max(0, delta.days + (1 if delta.seconds > 0 else 0))

    return {
        "status": state,
        "has_access": state in (STATUS_TRIAL, STATUS_ACTIVE),
        "until": until,
        "days_left": days_left,
        "is_trial": state == STATUS_TRIAL,
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
