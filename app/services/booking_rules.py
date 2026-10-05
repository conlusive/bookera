"""
Правила онлайн-запису закладу - ОДНЕ місце для слотів і для створення запису.

Раніше правила перевіряв лише сам запис: слоти показували час, який потім
відхилявся («заклад не працює в цей період», «не раніше ніж за 2 години»).
Тепер слоти прибирають те, що запис однаково не прийме, а запис перевіряє
ті самі правила тими самими функціями.

Усі часи тут - місцеві (час закладу, без пояса): так живуть слоти й записи.
Порівняння з UTC-«зараз» давало зсув на кілька годин: правило «за 2 години»
у Києві пропускало запис за 30 хвилин.
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional


def _num(v) -> Optional[float]:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def booking_disabled(rules: dict) -> Optional[str]:
    """Чому онлайн-запис зараз вимкнено (або None)."""
    if rules.get("is_active") is False:
        return "Онлайн-запис у цьому закладі вимкнено"
    if rules.get("is_paused_emergency") is True:
        return "Заклад тимчасово не приймає онлайн-записи"
    return None


def closed_period_reason(rules: dict, day: date) -> Optional[str]:
    """Якщо день потрапляє в закритий період - текст для клієнта, інакше None."""
    for period in rules.get("closed_periods") or []:
        try:
            start = date.fromisoformat(str(period.get("start")))
            end = date.fromisoformat(str(period.get("end")))
        except (TypeError, ValueError):
            continue
        if start <= day <= end:
            reason = str(period.get("reason") or "").strip()
            return f"Заклад не працює в цей період{f': {reason}' if reason else ''}"
    return None


def earliest_start(rules: dict, now_local: datetime) -> Optional[datetime]:
    """Найраніший дозволений початок візиту (min_advance_hours)."""
    hours = _num(rules.get("min_advance_hours"))
    return now_local + timedelta(hours=hours) if hours and hours > 0 else None


def latest_start(rules: dict, now_local: datetime) -> Optional[datetime]:
    """Найпізніший дозволений початок візиту (max_advance_days)."""
    days = _num(rules.get("max_advance_days"))
    return now_local + timedelta(days=days) if days and days > 0 else None


def advance_violation(rules: dict, start_local: datetime, now_local: datetime) -> Optional[str]:
    """Текст відмови, якщо запис занадто пізній чи занадто далекий."""
    early = earliest_start(rules, now_local)
    if early and start_local < early:
        return f"Записатись можна щонайменше за {int(_num(rules.get('min_advance_hours')))} год до візиту"
    late = latest_start(rules, now_local)
    if late and start_local > late:
        return f"Записатись можна не більше ніж на {int(_num(rules.get('max_advance_days')))} днів наперед"
    return None


def cancel_violation(rules: dict, start_local: datetime, now_local: datetime) -> Optional[str]:
    """Текст відмови, якщо клієнт скасовує пізніше, ніж дозволяє заклад (0 / не задано - будь-коли)."""
    hours = _num(rules.get("cancel_before_hours"))
    if not hours or hours <= 0:
        return None
    if start_local - now_local < timedelta(hours=hours):
        return (f"Скасувати онлайн можна не пізніше ніж за {int(hours)} год до візиту. "
                "Зв'яжіться із закладом напряму")
    return None


def deposit_for(payments: dict, price) -> Optional[Decimal]:
    """
    Передоплата за налаштуваннями закладу. fixed - сума в гривнях, percent -
    відсоток від ціни візиту. Більше за саму ціну не буває. Раніше тип
    ігнорувався: «20%» перетворювалось на 20 ₴.
    """
    if payments.get("require_deposit") is not True:
        return None
    amount = _num(payments.get("deposit_amount"))
    if not amount or amount <= 0:
        return None
    if payments.get("deposit_type") == "percent":
        if price is None:
            return None
        due = (Decimal(str(price)) * Decimal(str(min(amount, 100))) / Decimal(100)).quantize(Decimal("0.01"))
    else:
        due = Decimal(str(amount))
        if price is not None:
            due = min(due, Decimal(str(price)))
    return due if due > 0 else None
