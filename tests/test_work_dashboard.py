import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"
M = "work-master"


async def _salon(client, owner_id, name):
    return (await client.post("/crm/businesses", json={"name": name, "city": "Львів"}, headers=owner_id)).json()["id"]


async def _setup(client, auth_headers):
    a = await _salon(client, auth_headers("work-owner-a"), "Салон А")
    b = await _salon(client, auth_headers("work-owner-b"), "Салон Б")
    now = local_now().replace(tzinfo=None, second=0, microsecond=0)
    # Сьогодні о 01:00 і 03:00 - не перекриваються (у базі обмеження:
    # майстер не має двох записів одночасно) і завжди «сьогодні».
    day0 = now.replace(hour=0, minute=0)
    t1, t2 = day0 + timedelta(hours=1), day0 + timedelta(hours=3)
    tomorrow = day0 + timedelta(days=1, hours=10)
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("INSERT INTO users (id, email, role, is_active, created_at, business_id) VALUES ($1,'wm@example.com','master',true,now(),$2) ON CONFLICT DO NOTHING", M, a)
        for bid in (a, b):
            await conn.execute("INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at) VALUES ($1,$2,'master',true,now())", M, bid)
        sa = await conn.fetchval("INSERT INTO services (business_id, name, duration_minutes, price) VALUES ($1,'Стрижка',60,500) RETURNING id", a)
        sb = await conn.fetchval("INSERT INTO services (business_id, name, duration_minutes, price) VALUES ($1,'Манікюр',60,700) RETURNING id", b)
        ins = ("INSERT INTO appointments (business_id, service_id, master_id, start_time, end_time, status, price, client_name, source) "
               "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'online')")
        # Сьогодні - по запису в кожному салоні
        await conn.execute(ins, a, sa, M, t1, t1 + timedelta(hours=1), "confirmed", 500, "Олена")
        await conn.execute(ins, b, sb, M, t2, t2 + timedelta(hours=1), "confirmed", 700, "Ірина")
        # Завтра - «наступний клієнт» гарантовано в майбутньому
        await conn.execute(ins, a, sa, M, tomorrow, tomorrow + timedelta(hours=1), "confirmed", 500, "Марта")
        # Завершені за місяць
        for i in range(3):
            d = now - timedelta(days=i + 2)
            await conn.execute(ins, a, sa, M, d, d + timedelta(hours=1), "completed", 500, "К")
        d = now - timedelta(days=3)
        await conn.execute(ins, b, sb, M, d, d + timedelta(hours=1), "completed", 700, "К")
        # Чужий візит - не має потрапити
        await conn.execute(ins, a, sa, None, t1, t1 + timedelta(hours=1), "confirmed", 999, "Чужий")
    finally:
        await conn.close()
    return a, b


@pytest.mark.asyncio
async def test_master_sees_both_salons_together(client, auth_headers):
    a, b = await _setup(client, auth_headers)
    w = (await client.get("/work/me", headers=auth_headers(M))).json()

    assert {p["name"] for p in w["workplaces"]} == {"Салон А", "Салон Б"}
    assert {t["business_name"] for t in w["today"]} == {"Салон А", "Салон Б"}, "розклад з обох салонів разом"
    assert all(t["client_name"] != "Чужий" for t in w["today"]), "лише мої записи"
    assert w["stats_30d"]["visits"] == 4 and w["stats_30d"]["revenue"] == 2200
    assert len(w["daily"]) == 14
    assert w["next"] is not None


@pytest.mark.asyncio
async def test_client_without_work_gets_empty(client, auth_headers):
    """Звичайний клієнт - без розділу: список салонів порожній."""
    w = (await client.get("/work/me", headers=auth_headers("just-client"))).json()
    assert w == {"workplaces": []}


@pytest.mark.asyncio
async def test_stats_per_salon_and_period(client, auth_headers):
    a, b = await _setup(client, auth_headers)
    h = auth_headers(M)

    both = (await client.get("/work/me/stats", params={"days": 30}, headers=h)).json()
    assert both["visits"] == 4 and both["revenue"] == 2200 and both["avg_check"] == 550
    assert both["bucket"] == "day" and len(both["series"]) == 30
    assert sum(x["visits"] for x in both["series"]) == 4

    assert len(both["load"]) == 7 and all(len(r) == 24 for r in both["load"]) and sum(map(sum, both["load"])) == 4

    only_a = (await client.get("/work/me/stats", params={"days": 30, "business_id": a}, headers=h)).json()
    assert only_a["visits"] == 3 and only_a["revenue"] == 1500, "лише Салон А"
    assert only_a["top_services"][0]["name"] == "Стрижка" and only_a["top_services"][0]["visits"] == 3

    week = (await client.get("/work/me/stats", params={"days": 7, "business_id": b}, headers=h)).json()
    assert week["visits"] == 1 and len(week["series"]) == 7

    quarter = (await client.get("/work/me/stats", params={"days": 90}, headers=h)).json()
    assert quarter["bucket"] == "week" and sum(x["visits"] for x in quarter["series"]) == 4

    # чужий заклад - не мій
    other = await _salon(client, auth_headers("work-owner-c"), "Салон В")
    r = await client.get("/work/me/stats", params={"business_id": other}, headers=h)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_calendar_and_agenda_across_all_salons(client, auth_headers):
    a, b = await _setup(client, auth_headers)
    h = auth_headers(M)
    today = local_now().date()

    cal = (await client.get("/work/me/calendar", params={"month": today.strftime("%Y-%m")}, headers=h)).json()
    assert cal.get(today.isoformat()) == 2, "обидва салони разом"
    only_a = (await client.get("/work/me/calendar", params={"month": today.strftime("%Y-%m"), "business_id": a}, headers=h)).json()
    assert only_a.get(today.isoformat()) == 1

    day = (await client.get("/work/me/agenda", params={"date": today.isoformat()}, headers=h)).json()
    assert {x["business_name"] for x in day} == {"Салон А", "Салон Б"}
    assert all(x["client_name"] != "Чужий" for x in day)
