"""
Групи клієнтів - як у Booksy: ті, хто ходить регулярно, новачки, ті, хто давно не був, і втрачені.

Правила в ОДНОМУ місці: розсилка (app/api/crm/extras.py) бере аудиторію звідси, а кабінет (ClientsTab.tsx)
дзеркально рахує групи у браузері з тими ж межами, тож число біля групи й число листів збігаються.
Дні рахуються від останнього ЗАВЕРШЕНОГО візиту; хто вже записаний наперед, «давно не був» не вважається.

  regular   три й більше візитів і останній не давніше 90 днів (або вже є запис наперед)
  new       додано за останні 30 днів, не більше одного візиту
  lapsed1m  були, але 30-89 днів тому
  lapsed3m  були, але 90-364 дні тому
  lapsed1y  були, але рік і більше тому
  lost      був рівно один візит, і той 60+ днів тому - не повернувся
  away_N    не були N днів і більше (довільний поріг для фільтра «Нагадати»)
"""
import re
from datetime import date, datetime
from typing import Optional

REGULAR_VISITS = 3
REGULAR_WINDOW_DAYS = 90
NEW_DAYS = 30
LOST_DAYS = 60
MONTH_DAYS = 30
QUARTER_DAYS = 90
YEAR_DAYS = 365

GROUP_LABELS = {
    "regular": "ходять регулярно",
    "new": "новоприбулі",
    "lapsed1m": "не були місяць",
    "lapsed3m": "не були три місяці",
    "lost": "втрачені",
    "lapsed1y": "не було понад рік",
}
GROUP_IDS = tuple(GROUP_LABELS)

_AWAY = re.compile(r"^away_(\d{2,4})$")


def away_days(audience: str) -> Optional[int]:
    m = _AWAY.match(audience or "")
    if not m:
        return None
    n = int(m.group(1))
    return n if 14 <= n <= 1825 else None


def is_known(audience: str) -> bool:
    return audience in ("all", "regular", "lapsed") or audience in GROUP_IDS or away_days(audience) is not None


def _days_since(moment: Optional[datetime], today: date) -> Optional[int]:
    return (today - moment.date()).days if moment else None


def in_group(group: str, *, visits: int, last_visit_at: Optional[datetime], next_visit_at: Optional[datetime],
             created_at: Optional[datetime], today: date) -> bool:
    since = _days_since(last_visit_at, today)
    upcoming = next_visit_at is not None
    if group == "regular":
        return visits >= REGULAR_VISITS and (upcoming or (since is not None and since <= REGULAR_WINDOW_DAYS))
    if group == "new":
        return visits <= 1 and created_at is not None and (today - created_at.date()).days <= NEW_DAYS
    if group == "lost":
        return visits == 1 and not upcoming and since is not None and since >= LOST_DAYS
    if group == "lapsed1m":
        return not upcoming and since is not None and MONTH_DAYS <= since < QUARTER_DAYS
    if group == "lapsed3m":
        return not upcoming and since is not None and QUARTER_DAYS <= since < YEAR_DAYS
    if group == "lapsed1y":
        return not upcoming and since is not None and since >= YEAR_DAYS
    if group == "lapsed":  # старий варіант розсилки: 60+ днів
        return not upcoming and since is not None and since >= 60
    n = away_days(group)
    if n is not None:
        return not upcoming and since is not None and since >= n
    return True
