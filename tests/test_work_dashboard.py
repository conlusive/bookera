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
