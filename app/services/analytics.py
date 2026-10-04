"""
Аналітика закладу - ОДНЕ місце, де рахуються цифри для вкладки «Аналітика».

Раніше вкладка рахувала все в браузері, і цифри були хибні:
  - дохід - за ПОТОЧНОЮ ціною послуги з каталогу, а не за фактичною
    сумою візиту (знижки, доповнення, зміна цін ламали суму);
  - «нові / постійні» - лише за візитами обраного періоду, тож усі
    здавались новими;
  - «джерела залучення» вигадувались (55% / 30% / 15%), якщо жодне
    не розпізнавалось;
  - у прибуток потрапляли прогнозовані зарплати й майбутні витрати.

Правила тут:
  дохід            сума price завершених візитів (status = completed)
  витрати          expenses з датою ДО СЬОГОДНІ включно (майбутні платежі
                   ще не відбулись); виплати зарплат - це теж витрати
  прибуток         дохід - витрати
  середній чек     дохід / кількість завершених
  скасування       (скасовано + неявка) / (завершено + скасовано + неявка)
  клієнт           client_id, а для записів без нього - останні 9 цифр
                   телефону (так само, як у «Клієнтах»)
  новий            перший завершений візит клієнта припав на період
  повернувся       був у періоді й мав завершений візит ДО нього
  давно не був     останній візит понад LAPSED_DAYS днів тому, нічого
                   не заплановано (те саме правило, що в розсилках)
  джерело          поле source запису - без здогадок
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from statistics import median
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time_utils import local_now
from app.models import Appointment, Client, Expense, Service, User
from app.services.client_stats import phone_tail

LAPSED_DAYS = 60
REGULAR_VISITS = 3

SOURCE_LABELS = {
    "marketplace": "Вітрина BookEra",
    "direct": "Пряме посилання",
    "manual": "Внесено вручну",
    "crm": "Внесено вручну",
    "widget": "Віджет на сайті",
    "instagram": "Instagram",
}

DONE = "completed"
NO_SHOW = "no-show"
CANCELLED = "cancelled"
UPCOMING = ("confirmed", "pending_approval")


def _day_bounds(d: date) -> tuple:
    return datetime.combine(d, datetime.min.time()), datetime.combine(d, datetime.max.time())


def _num(v) -> float:
    return float(v) if v is not None else 0.0


def _summary(rows: list, ident_of, first_visit: Dict[str, datetime], start: datetime, end: datetime, now: datetime) -> dict:
    done = [r for r in rows if r.status == DONE]
    cancelled = [r for r in rows if r.status == CANCELLED]
    no_show = [r for r in rows if r.status == NO_SHOW]
    upcoming = [r for r in rows if r.status in UPCOMING and r.start_time > now]
    revenue = sum(_num(r.price) for r in done)
    lost_slots = len(cancelled) + len(no_show)
    denominator = len(done) + lost_slots

    people = {ident_of(r) for r in done if ident_of(r)}
    new_people = {p for p in people if start <= first_visit.get(p, datetime.max) <= end}
    return {
        "revenue": round(revenue, 2),
        "completed": len(done),
        "cancelled": len(cancelled),
        "no_show": len(no_show),
        "upcoming": len(upcoming),
        "avg_check": round(revenue / len(done), 2) if done else 0.0,
        "cancel_rate": round(lost_slots / denominator * 100, 1) if denominator else 0.0,
        "clients": len(people),
        "new_clients": len(new_people),
        "returning_clients": len(people - new_people),
        "tips": round(sum(_num(r.tip_amount) for r in done), 2),
    }


async def build_analytics(
    db: AsyncSession, business_id: int, start: date, end: date,
    compare_from: Optional[date] = None, compare_to: Optional[date] = None,
) -> dict:
    """
    compare_from / compare_to - з чим порівнювати (за замовчуванням - період
    тієї ж довжини одразу перед обраним). Якщо обраний період ще триває
    (сьогодні всередині), порівнюємо лише з таким самим числом ПЕРШИХ днів:
    5 днів жовтня проти цілого вересня - несправедливе «-80%».
    """
    if end < start:
        start, end = end, start
    length = (end - start).days + 1
    now = local_now().replace(tzinfo=None)
    today = now.date()

    if compare_from and compare_to and compare_from <= compare_to:
        prev_start, prev_end = compare_from, compare_to
    else:
        prev_end = start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=length - 1)
    elapsed = None
    if start <= today <= end and today < end:
        elapsed = (today - start).days + 1
        prev_end = min(prev_end, prev_start + timedelta(days=elapsed - 1))
    cur_from, cur_to = _day_bounds(start)[0], _day_bounds(end)[1]
    prev_from, prev_to = _day_bounds(prev_start)[0], _day_bounds(prev_end)[1]

    # --- записи за обидва періоди (без блокувань часу) ---
    A = Appointment
    rows = (await db.execute(
        select(A.id, A.status, A.price, A.tip_amount, A.start_time, A.service_id, A.master_id,
               A.client_id, A.client_phone, A.client_name, A.source)
        .where(A.business_id == business_id, A.start_time >= prev_from, A.start_time <= cur_to,
               A.status != "blocked", A.service_id.isnot(None))
    )).all()

    # --- клієнти й уся історія завершених візитів (для «нових / повернулись») ---
    clients = (await db.execute(select(Client.id, Client.name, Client.phone).where(Client.business_id == business_id))).all()
    by_tail = {phone_tail(c.phone): c.id for c in clients if phone_tail(c.phone)}
    name_by_id = {c.id: c.name for c in clients}

    def ident_of(r) -> Optional[str]:
        if r.client_id:
            return f"c{r.client_id}"
        tail = phone_tail(r.client_phone)
        if tail and tail in by_tail:
            return f"c{by_tail[tail]}"
        return f"p{tail}" if tail else None

    history = (await db.execute(
        select(A.client_id, A.client_phone, A.client_name, A.start_time, A.price)
        .where(A.business_id == business_id, A.status == DONE, A.start_time <= cur_to)
        .order_by(A.start_time)
    )).all()
    visits: Dict[str, List[datetime]] = defaultdict(list)
    spent: Dict[str, float] = defaultdict(float)
    display_name: Dict[str, str] = {}
    for h in history:
        k = ident_of(h)
        if not k:
            continue
        visits[k].append(h.start_time)
        spent[k] += _num(h.price)
        display_name.setdefault(k, name_by_id.get(int(k[1:])) if k.startswith("c") and k[1:].isdigit() else None)
        if not display_name.get(k):
            display_name[k] = h.client_name or "Клієнт"
    first_visit = {k: v[0] for k, v in visits.items()}

    cur_rows = [r for r in rows if cur_from <= r.start_time <= cur_to]
    prev_rows = [r for r in rows if prev_from <= r.start_time <= prev_to]
    current = _summary(cur_rows, ident_of, first_visit, cur_from, cur_to, now)
    previous = _summary(prev_rows, ident_of, first_visit, prev_from, prev_to, now)

    # --- динаміка по днях ---
    # Майбутні дні не малюємо: там ще нічого не могло завершитись.
    shown_days = (min(end, today) - start).days + 1 if start <= today else length
    by_day: Dict[date, dict] = {start + timedelta(days=i): {"revenue": 0.0, "completed": 0} for i in range(max(shown_days, 1))}
    for r in cur_rows:
        if r.status == DONE and r.start_time.date() in by_day:
            d = by_day[r.start_time.date()]
            d["revenue"] += _num(r.price)
            d["completed"] += 1
    series = [{"date": d.isoformat(), "revenue": round(v["revenue"], 2), "completed": v["completed"]} for d, v in by_day.items()]

    # --- гроші ---
    exp_to = min(end, today)
    expenses_by_cat: Dict[str, float] = {}
    if exp_to >= start:
        exp_rows = (await db.execute(
            select(Expense.category, func.coalesce(func.sum(Expense.amount), 0))
            .where(Expense.business_id == business_id, Expense.expense_date >= start, Expense.expense_date <= exp_to)
            .group_by(Expense.category)
        )).all()
        expenses_by_cat = {(c or "Інше"): _num(a) for c, a in exp_rows}
    expenses_total = round(sum(expenses_by_cat.values()), 2)
    money = {
        "revenue": current["revenue"],
        "expenses": expenses_total,
        "profit": round(current["revenue"] - expenses_total, 2),
        "tips": current["tips"],
        "expenses_by_category": sorted(
            [{"category": c, "amount": round(a, 2)} for c, a in expenses_by_cat.items()], key=lambda x: -x["amount"]
        ),
        "expenses_through": exp_to.isoformat() if exp_to >= start else None,
    }

    # --- помісячно: дохід / витрати / прибуток за 6 місяців, що закінчуються
    # місяцем кінця періоду. Те, чого немає у «Склад і Витрати»: там - список
    # платежів, тут - підсумок і динаміка.
    months = []
    y, m = end.year, end.month
    for _ in range(6):
        months.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    months.reverse()
    range_from = date(months[0][0], months[0][1], 1)
    range_to = (date(end.year + (end.month == 12), end.month % 12 + 1, 1) - timedelta(days=1))
    rev_by_month = {(r.y, r.m): _num(r.total) for r in (await db.execute(
        select(func.extract("year", A.start_time).label("y"), func.extract("month", A.start_time).label("m"),
               func.coalesce(func.sum(A.price), 0).label("total"))
        .where(A.business_id == business_id, A.status == DONE,
               A.start_time >= datetime.combine(range_from, datetime.min.time()),
               A.start_time <= datetime.combine(range_to, datetime.max.time()))
        .group_by("y", "m")
    )).all()}
    exp_by_month = {}
    exp_limit = min(range_to, today)
    if exp_limit >= range_from:
        exp_by_month = {(r.y, r.m): _num(r.total) for r in (await db.execute(
            select(func.extract("year", Expense.expense_date).label("y"), func.extract("month", Expense.expense_date).label("m"),
                   func.coalesce(func.sum(Expense.amount), 0).label("total"))
            .where(Expense.business_id == business_id, Expense.expense_date >= range_from, Expense.expense_date <= exp_limit)
            .group_by("y", "m")
        )).all()}
    monthly = []
    for (yy, mm) in months:
        rev = rev_by_month.get((yy, mm), 0.0)
        exp = exp_by_month.get((yy, mm), 0.0)
        monthly.append({"month": f"{yy}-{mm:02d}", "revenue": round(rev, 2), "expenses": round(exp, 2), "profit": round(rev - exp, 2)})

    # --- послуги ---
    svc_names = {s.id: s.name for s in (await db.execute(select(Service.id, Service.name).where(Service.business_id == business_id))).all()}
    svc_acc: Dict[int, dict] = {}
    for r in cur_rows:
        if r.status != DONE or not r.service_id:
            continue
        s = svc_acc.setdefault(r.service_id, {"count": 0, "revenue": 0.0})
        s["count"] += 1
        s["revenue"] += _num(r.price)
    services = sorted(
        [{
            "service_id": sid, "name": svc_names.get(sid, "Видалена послуга"), "count": v["count"],
            "revenue": round(v["revenue"], 2), "avg_price": round(v["revenue"] / v["count"], 2) if v["count"] else 0.0,
            "share": round(v["revenue"] / current["revenue"] * 100, 1) if current["revenue"] else 0.0,
        } for sid, v in svc_acc.items()],
        key=lambda x: -x["revenue"],
    )

    # --- команда ---
    staff_names = {u.id: u.full_name for u in (await db.execute(
        select(User.id, User.full_name).where(User.business_id == business_id))).all()}
    staff_acc: Dict[Optional[str], dict] = {}
    for r in cur_rows:
        a = staff_acc.setdefault(r.master_id, {"completed": 0, "revenue": 0.0, "lost": 0, "tips": 0.0})
        if r.status == DONE:
            a["completed"] += 1
            a["revenue"] += _num(r.price)
            a["tips"] += _num(r.tip_amount)
        elif r.status in (CANCELLED, NO_SHOW):
            a["lost"] += 1
    staff = sorted(
        [{
            "staff_id": sid,
            "name": "Без майстра" if sid is None else (staff_names.get(sid) or "Майстер") if sid in staff_names else "Колишній співробітник",
            "completed": v["completed"], "revenue": round(v["revenue"], 2),
            "avg_check": round(v["revenue"] / v["completed"], 2) if v["completed"] else 0.0,
            "share": round(v["revenue"] / current["revenue"] * 100, 1) if current["revenue"] else 0.0,
            "cancel_rate": round(v["lost"] / (v["completed"] + v["lost"]) * 100, 1) if (v["completed"] + v["lost"]) else 0.0,
            "tips": round(v["tips"], 2),
        } for sid, v in staff_acc.items() if v["completed"] or v["lost"]],
        key=lambda x: -x["revenue"],
    )

    # --- джерела (за фактичним полем source) ---
    src_acc: Dict[str, dict] = {}
    for r in cur_rows:
        if r.status not in (DONE, *UPCOMING):
            continue
        label = SOURCE_LABELS.get(r.source or "", r.source or "Інше")
        s = src_acc.setdefault(label, {"count": 0, "revenue": 0.0})
        s["count"] += 1
        s["revenue"] += _num(r.price) if r.status == DONE else 0.0
    total_src = sum(v["count"] for v in src_acc.values())
    sources = sorted(
        [{"label": k, "count": v["count"], "revenue": round(v["revenue"], 2),
          "share": round(v["count"] / total_src * 100, 1) if total_src else 0.0} for k, v in src_acc.items()],
        key=lambda x: -x["count"],
    )

    # --- клієнти ---
    people_now = {ident_of(r) for r in cur_rows if r.status == DONE and ident_of(r)}
    lapsed = 0
    regular = 0
    upcoming_people = {ident_of(r) for r in rows if r.status in UPCOMING and r.start_time > now and ident_of(r)}
    # «Давно не були» / «постійні» - за всією історією, станом на кінець періоду
    ref = min(cur_to, now)
    for k, v in visits.items():
        if len(v) >= REGULAR_VISITS:
            regular += 1
        if (ref - v[-1]).days >= LAPSED_DAYS and k not in upcoming_people:
            lapsed += 1
    gaps = [(b - a).days for v in visits.values() for a, b in zip(v, v[1:])]
    top_clients = sorted(
        [{"name": display_name.get(k) or "Клієнт", "visits": sum(1 for t in visits[k] if cur_from <= t <= cur_to),
          "spent": round(sum(_num(r.price) for r in cur_rows if r.status == DONE and ident_of(r) == k), 2)}
         for k in people_now],
        key=lambda x: -x["spent"],
    )[:5]
    returning_share = round(current["returning_clients"] / current["clients"] * 100, 1) if current["clients"] else 0.0
    clients_block = {
        "active": current["clients"],
        "new": current["new_clients"],
        "returning": current["returning_clients"],
        "returning_share": returning_share,
        "regular": regular,
        "lapsed": lapsed,
        "avg_gap_days": round(median(gaps), 1) if gaps else None,
        # Середній дохід з клієнта за ВЕСЬ час (а не за період): інакше
        # цифра залежала б від довжини обраного періоду.
        "avg_lifetime_value": round(sum(spent.values()) / len(spent), 2) if spent else 0.0,
        "top": top_clients,
    }

    # --- завантаженість: коли записи (день тижня × година) ---
    heat = [[0] * 24 for _ in range(7)]
    for r in cur_rows:
        if r.status in (DONE, *UPCOMING):
            heat[r.start_time.weekday()][r.start_time.hour] += 1
    weekday_totals = [sum(row) for row in heat]
    busiest = max(range(7), key=lambda i: weekday_totals[i]) if any(weekday_totals) else None
    quietest = min(range(7), key=lambda i: weekday_totals[i]) if any(weekday_totals) else None

    return {
        "period": {"start": start.isoformat(), "end": end.isoformat(), "days": length},
        "previous_period": {"start": prev_start.isoformat(), "end": prev_end.isoformat(), "elapsed_days": elapsed},
        "current": current,
        "previous": previous,
        "series": series,
        "money": money,
        "monthly": monthly,
        "clients": clients_block,
        "services": services,
        "staff": staff,
        "sources": sources,
        "load": {"heatmap": heat, "weekday_totals": weekday_totals, "busiest_weekday": busiest, "quietest_weekday": quietest},
    }


async def month_progress(db: AsyncSession, business_id: int, goal: Optional[float]) -> dict:
    """Ціль місяця: скільки вже зароблено цього календарного місяця й скільки днів лишилось."""
    today = local_now().date()
    month_start = today.replace(day=1)
    next_month = (month_start + timedelta(days=32)).replace(day=1)
    month_end = next_month - timedelta(days=1)
    revenue = (await db.execute(
        select(func.coalesce(func.sum(Appointment.price), 0)).where(
            Appointment.business_id == business_id, Appointment.status == DONE,
            Appointment.start_time >= datetime.combine(month_start, datetime.min.time()),
            Appointment.start_time <= datetime.combine(month_end, datetime.max.time()),
        )
    )).scalar() or 0
    revenue = float(revenue)
    return {
        "goal": goal,
        "month_start": month_start.isoformat(),
        "month_revenue": round(revenue, 2),
        "percent": round(min(revenue / goal * 100, 999), 1) if goal else None,
        "days_left": (month_end - today).days,
    }
