"""
Аналітика: правила рахунку з app/services/analytics.py.
Період у тестах - березень 2026, у минулому, тож вони не старіють.
"""
import asyncpg
import pytest
from datetime import date, datetime, timedelta

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"
START, END = "2026-03-01", "2026-03-31"


async def _sql(query, *args):
    conn = await asyncpg.connect(DB)
    try:
        return await conn.fetch(query, *args)
    finally:
        await conn.close()


async def _seed(client, auth_headers, tag):
    h = auth_headers(f"an-{tag}")
    bid = (await client.post("/crm/businesses", json={"name": "Аналітика", "city": "Львів"}, headers=h)).json()["id"]
    s1 = (await client.post("/services", json={"business_id": bid, "name": "Манікюр", "duration_minutes": 60, "price": 500}, headers=h)).json()["id"]
    s2 = (await client.post("/services", json={"business_id": bid, "name": "Педикюр", "duration_minutes": 60, "price": 300}, headers=h)).json()["id"]
    return h, bid, s1, s2


async def _appt(bid, service, when, status, price, phone, name, source="direct", master=None):
    start = datetime.fromisoformat(when)
    await _sql(
        "INSERT INTO appointments (business_id, service_id, client_name, client_phone, start_time, end_time, status, price, source, master_id) "
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        bid, service, name, phone, start, start + timedelta(hours=1), status, price, source, master)


async def _scenario(client, auth_headers, tag):
    h, bid, s1, s2 = await _seed(client, auth_headers, tag)
    A, B, C, D = "+380501110001", "+380501110002", "+380501110003", "+380501110004"
    # історія до періоду: A - постійний (3 візити), D - давно не був
    await _appt(bid, s1, "2026-01-15T10:00:00", "completed", 350, A, "Анна")
    await _appt(bid, s1, "2026-02-10T10:00:00", "completed", 400, A, "Анна")
    await _appt(bid, s2, "2025-12-01T10:00:00", "completed", 250, D, "Дмитро")
    # березень
    await _appt(bid, s1, "2026-03-05T10:00:00", "completed", 450, A, "Анна", "marketplace")   # знижка: у каталозі 500
    await _appt(bid, s1, "2026-03-06T11:00:00", "completed", 500, B, "Богдан", "direct")
    await _appt(bid, s2, "2026-03-20T11:00:00", "completed", 300, B, "Богдан", "direct")
    await _appt(bid, s2, "2026-03-07T12:00:00", "completed", 300, C, "Ірина", "manual")
    await _appt(bid, s1, "2026-03-08T12:00:00", "cancelled", 500, C, "Ірина")
    await _appt(bid, s1, "2026-03-15T10:00:00", "no-show", 500, A, "Анна")
    await _sql("INSERT INTO appointments (business_id, client_name, start_time, end_time, status, source) "
               "VALUES ($1,'Обід','2026-03-09 13:00','2026-03-09 14:00','blocked','crm')", bid)
    await _sql("INSERT INTO expenses (business_id, category, amount, expense_date, recurrence) VALUES "
               "($1,'Оренда',1000,'2026-03-01','none'),($1,'Матеріали',200,'2026-03-10','none')", bid)
    return h, bid, s1, s2


async def _get(client, h, bid, **params):
    r = await client.get(f"/crm/businesses/{bid}/analytics", params={"date_from": START, "date_to": END, **params}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.asyncio
async def test_revenue_uses_the_real_visit_price_not_the_catalog(client, auth_headers):
    h, bid, s1, s2 = await _scenario(client, auth_headers, "rev")
    cur = (await _get(client, h, bid))["current"]
    assert cur["revenue"] == 450 + 500 + 300 + 300, "знижка 450 враховується, а не каталожні 500"
    assert cur["completed"] == 4 and cur["cancelled"] == 1 and cur["no_show"] == 1
    assert cur["avg_check"] == 387.5
    assert cur["cancel_rate"] == pytest.approx(33.3)
    assert cur["upcoming"] == 0


@pytest.mark.asyncio
async def test_previous_period_has_the_same_length(client, auth_headers):
    h, bid, *_ = await _scenario(client, auth_headers, "prev")
    data = await _get(client, h, bid)
    assert data["period"]["days"] == 31
    assert data["previous_period"] == {"start": "2026-01-29", "end": "2026-02-28", "elapsed_days": None}
    assert data["previous"]["revenue"] == 400, "лише візит 10 лютого: 15 січня - раніше за попередній період"


@pytest.mark.asyncio
async def test_new_and_returning_use_the_whole_history(client, auth_headers):
    h, bid, *_ = await _scenario(client, auth_headers, "cli")
    c = (await _get(client, h, bid))["clients"]
    assert (c["active"], c["new"], c["returning"]) == (3, 2, 1), "Анна була раніше; Богдан з Іриною - уперше"
    assert c["returning_share"] == pytest.approx(33.3)
    assert c["regular"] == 1 and c["lapsed"] == 1, "Анна має 3 візити, Дмитро не був з грудня"
    assert c["avg_lifetime_value"] == 637.5, "за весь час: (1200 + 800 + 300 + 250) / 4"
    assert [t["name"] for t in c["top"]][0] == "Богдан" and c["top"][0]["spent"] == 800


@pytest.mark.asyncio
async def test_money_profit_is_revenue_minus_expenses(client, auth_headers):
    h, bid, *_ = await _scenario(client, auth_headers, "mon")
    m = (await _get(client, h, bid))["money"]
    assert (m["revenue"], m["expenses"], m["profit"]) == (1550, 1200, 350)
    assert {e["category"]: e["amount"] for e in m["expenses_by_category"]} == {"Оренда": 1000, "Матеріали": 200}


@pytest.mark.asyncio
async def test_future_expenses_are_not_in_profit(client, auth_headers):
    h, bid, *_ = await _seed(client, auth_headers, "fut")
    today = date.today()
    await _sql("INSERT INTO expenses (business_id, category, amount, expense_date, recurrence) VALUES "
               "($1,'Оренда',100,$2,'none'),($1,'Оренда',900,$3,'none')", bid, today, today + timedelta(days=5))
    r = await client.get(f"/crm/businesses/{bid}/analytics", params={"date_from": str(today), "date_to": str(today + timedelta(days=10))}, headers=h)
    assert r.json()["money"]["expenses"] == 100, "платіж через 5 днів ще не відбувся"


@pytest.mark.asyncio
async def test_services_sources_and_blocks_are_real(client, auth_headers):
    h, bid, s1, s2 = await _scenario(client, auth_headers, "svc")
    data = await _get(client, h, bid)
    by_name = {s["name"]: s for s in data["services"]}
    assert by_name["Манікюр"]["revenue"] == 950 and by_name["Манікюр"]["count"] == 2
    assert by_name["Педикюр"]["revenue"] == 600
    assert by_name["Манікюр"]["share"] == pytest.approx(61.3, abs=0.1)
    src = {s["label"]: s["count"] for s in data["sources"]}
    assert src == {"Пряме посилання": 2, "Вітрина BookEra": 1, "Внесено вручну": 1}, "справжні джерела, без вигаданих відсотків"
    assert data["current"]["completed"] == 4, "блокування часу не рахується записом"


@pytest.mark.asyncio
async def test_staff_split_and_load_heatmap(client, auth_headers):
    h, bid, s1, s2 = await _seed(client, auth_headers, "stf")
    master = "an-stf"  # власник теж майстер: рядок у users створюється разом із закладом
    await _appt(bid, s1, "2026-03-05T10:00:00", "completed", 500, "+380501110009", "Клієнт", master=master)
    await _appt(bid, s1, "2026-03-12T10:00:00", "completed", 700, "+380501110010", "Клієнт 2")
    data = await _get(client, h, bid)
    by = {s["staff_id"]: s for s in data["staff"]}
    assert by[master]["revenue"] == 500 and by[None]["name"] == "Без майстра" and by[None]["revenue"] == 700
    assert sum(s["share"] for s in data["staff"]) == pytest.approx(100, abs=0.2)
    wd = date(2026, 3, 5).weekday()
    assert data["load"]["heatmap"][wd][10] == 2 and data["load"]["busiest_weekday"] == wd


@pytest.mark.asyncio
async def test_goal_is_saved_and_progress_is_computed(client, auth_headers):
    h, bid, *_ = await _seed(client, auth_headers, "goal")
    r = await client.put(f"/crm/businesses/{bid}/analytics/goal", json={"amount": 20000}, headers=h)
    assert r.status_code == 200, r.text
    goal = (await _get(client, h, bid))["goal"]
    assert goal["goal"] == 20000 and goal["month_revenue"] >= 0
    other = auth_headers("an-goal-stranger")
    await client.post("/crm/businesses", json={"name": "Чужий", "city": "Львів"}, headers=other)
    assert (await client.put(f"/crm/businesses/{bid}/analytics/goal", json={"amount": 1}, headers=other)).status_code in (403, 404)
    assert (await client.put(f"/crm/businesses/{bid}/analytics/goal", json={"amount": -5}, headers=h)).status_code == 422
    r = await client.put(f"/crm/businesses/{bid}/analytics/goal", json={"amount": None}, headers=h)
    assert r.json()["goal"] is None


@pytest.mark.asyncio
async def test_empty_business_returns_zeros_not_errors(client, auth_headers):
    h, bid, *_ = await _seed(client, auth_headers, "empty")
    data = await _get(client, h, bid)
    assert data["current"]["revenue"] == 0 and data["clients"]["active"] == 0
    assert data["services"] == [] and data["staff"] == [] and data["sources"] == []
    assert data["load"]["busiest_weekday"] is None
    r = await client.get(f"/crm/businesses/{bid}/analytics", params={"date_from": "2020-01-01", "date_to": "2026-03-01"}, headers=h)
    assert r.status_code == 400, "завеликий період відхиляється"


@pytest.mark.asyncio
async def test_running_period_is_compared_with_the_same_number_of_days(client, auth_headers):
    h, bid, s1, s2 = await _seed(client, auth_headers, "run")
    today = date.today()
    start, end = today - timedelta(days=2), today + timedelta(days=4)       # 7 днів, минуло 3
    c_from, c_to = start - timedelta(days=7), start - timedelta(days=1)      # минулі 7 днів
    # у перші 3 дні минулого періоду - 500, на 5-й день - 900 (його порівнювати ще рано)
    await _appt(bid, s1, f"{c_from}T10:00:00", "completed", 500, "+380501110001", "А")
    await _appt(bid, s1, f"{c_from + timedelta(days=4)}T10:00:00", "completed", 900, "+380501110002", "Б")
    r = await client.get(f"/crm/businesses/{bid}/analytics", params={
        "date_from": str(start), "date_to": str(end), "compare_from": str(c_from), "compare_to": str(c_to)}, headers=h)
    data = r.json()
    assert data["previous_period"]["elapsed_days"] == 3
    assert data["previous_period"]["end"] == str(c_from + timedelta(days=2))
    assert data["previous"]["revenue"] == 500, "день, якого в поточному періоді ще не було, не рахується"
    assert len(data["series"]) == 3, "майбутні дні в графіку не показуються"


@pytest.mark.asyncio
async def test_monthly_result_covers_six_months_ending_with_the_period(client, auth_headers):
    h, bid, *_ = await _scenario(client, auth_headers, "mth")
    monthly = (await _get(client, h, bid))["monthly"]
    assert [m["month"] for m in monthly] == ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]
    by = {m["month"]: m for m in monthly}
    assert by["2025-12"]["revenue"] == 250 and by["2026-01"]["revenue"] == 350 and by["2026-02"]["revenue"] == 400
    assert by["2026-03"] == {"month": "2026-03", "revenue": 1550, "expenses": 1200, "profit": 350}
    assert by["2025-11"]["revenue"] == 0 and by["2025-11"]["profit"] == 0
