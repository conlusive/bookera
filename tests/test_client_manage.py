import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _booking(client, headers):
    """Заклад, що працює щодня 9-20, і запис на завтра о 10:00."""
    r = await client.post("/crm/businesses", json={"name": "Manage Salon", "city": "Львів"}, headers=headers)
    bid = r.json()["id"]
    await client.put(f"/crm/businesses/{bid}/hours", json=[
        {"weekday": d, "is_closed": False, "is_open": True, "open_time": "09:00", "close_time": "20:00"} for d in range(7)
    ], headers=headers)
    tomorrow = (local_now() + timedelta(days=1)).replace(tzinfo=None, hour=10, minute=0, second=0, microsecond=0)
    conn = await asyncpg.connect(DB)
    try:
        sid = await conn.fetchval("INSERT INTO services (business_id, name, duration_minutes, price) VALUES ($1,'Стрижка',60,400) RETURNING id", bid)
        aid = await conn.fetchval(
            """INSERT INTO appointments (business_id, service_id, start_time, end_time, status, client_email, manage_token, source)
               VALUES ($1,$2,$3,$4,'confirmed','c@example.com',$5,'online') RETURNING id""",
            bid, sid, tomorrow, tomorrow + timedelta(hours=1), f"mt-{bid}")
    finally:
        await conn.close()
    return aid, f"mt-{bid}", tomorrow


async def _status_and_start(aid):
    conn = await asyncpg.connect(DB)
    try:
        return await conn.fetchrow("SELECT status, start_time FROM appointments WHERE id = $1", aid)
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_cancel_really_changes_database(client, auth_headers):
    """
    Раніше профіль «скасовував» напряму в Supabase - правила доступу
    блокували, а інтерфейс показував успіх. Після перезавантаження
    запис повертався. Тепер перевіряємо саму базу.
    """
    aid, token, _ = await _booking(client, auth_headers("cm-1"))
    r = await client.post(f"/appointments/{aid}/cancel", json={"token": token})
    assert r.status_code == 200, r.text
    assert (await _status_and_start(aid))["status"] == "cancelled"


@pytest.mark.asyncio
async def test_reschedule_really_moves_booking(client, auth_headers):
    aid, token, tomorrow = await _booking(client, auth_headers("cm-2"))
    new = tomorrow.replace(hour=15)
    r = await client.post(f"/appointments/{aid}/reschedule", json={"token": token, "start_time": new.isoformat()})
    assert r.status_code == 200, r.text
    row = await _status_and_start(aid)
    assert row["start_time"] == new, "у базі - новий час"


@pytest.mark.asyncio
async def test_reschedule_outside_hours_rejected(client, auth_headers):
    """О 23:00 заклад не працює - перенесення відхилено, а не прийнято мовчки."""
    aid, token, tomorrow = await _booking(client, auth_headers("cm-3"))
    r = await client.post(f"/appointments/{aid}/reschedule", json={"token": token, "start_time": tomorrow.replace(hour=23).isoformat()})
    assert r.status_code == 409
    assert (await _status_and_start(aid))["start_time"] == tomorrow, "час лишився старим"


@pytest.mark.asyncio
async def test_reschedule_with_wrong_token_rejected(client, auth_headers):
    aid, _, tomorrow = await _booking(client, auth_headers("cm-4"))
    r = await client.post(f"/appointments/{aid}/reschedule", json={"token": "чужий", "start_time": tomorrow.replace(hour=15).isoformat()})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_cannot_reschedule_cancelled(client, auth_headers):
    aid, token, tomorrow = await _booking(client, auth_headers("cm-5"))
    await client.post(f"/appointments/{aid}/cancel", json={"token": token})
    r = await client.post(f"/appointments/{aid}/reschedule", json={"token": token, "start_time": tomorrow.replace(hour=15).isoformat()})
    assert r.status_code == 409
