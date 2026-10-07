"""«Будь-який майстер» при онлайн-записі: розподіл між майстрами, відмова коли всі зайняті, графік і список послуг."""
from datetime import timedelta

import asyncpg
import pytest

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _setup(client, auth_headers, tag, masters=2):
    owner = auth_headers(f"am-owner-{tag}")
    bid = (await client.post("/crm/businesses", json={"name": "Any", "city": "Львів"}, headers=owner)).json()["id"]
    await client.put(f"/crm/businesses/{bid}/hours", json=[
        {"weekday": d, "is_closed": False, "is_open": True, "open_time": "09:00", "close_time": "20:00"} for d in range(7)
    ], headers=owner)
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 500},
                             headers=owner)).json()["id"]
    ids = []
    conn = await asyncpg.connect(DB)
    try:
        for i in range(masters):
            m = f"am-m{i}-{tag}"
            ids.append(m)
            await conn.execute("INSERT INTO users (id, email, role, is_active, created_at, business_id) VALUES ($1,$2,'master',true,now(),$3)",
                               m, f"{m}@example.com", bid)
            await conn.execute("INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at) VALUES ($1,$2,'master',true,now())", m, bid)
    finally:
        await conn.close()
    day = (local_now() + timedelta(days=2)).date()
    return bid, sid, ids, owner, day


def _at(day, hour):
    return f"{day.isoformat()}T{hour:02d}:00:00"


async def _book(client, bid, sid, start, session, master="0", expect=200):
    lock = await client.post("/appointments/lock", json={"business_id": bid, "service_id": sid, "start_time": start, "master_id": master, "session_token": session})
    if expect != 200 and lock.status_code == expect:
        return lock
    assert lock.status_code == 200, lock.text
    r = await client.post("/appointments", json={
        "business_id": bid, "service_id": sid, "start_time": start, "master_id": master, "session_token": session,
        "client_name": "Клієнт", "client_phone": "+38067000" + session[-4:].rjust(4, "0"), "client_email": f"{session}@t.com",
    })
    assert r.status_code == expect, r.text
    return r


async def _master_of(appt_id):
    conn = await asyncpg.connect(DB)
    try:
        return await conn.fetchval("SELECT master_id FROM appointments WHERE id=$1", appt_id)
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_any_master_spreads_and_refuses_when_all_busy(client, auth_headers):
    bid, sid, (m0, m1), owner, day = await _setup(client, auth_headers, "spread")
    a = (await _book(client, bid, sid, _at(day, 12), "s0001")).json()
    b = (await _book(client, bid, sid, _at(day, 12), "s0002")).json()
    assert {await _master_of(a["id"]), await _master_of(b["id"])} == {m0, m1}, "двоє клієнтів на один час - різні майстри"
    # третій на цей самий час: обидва зайняті - чесна відмова, а не запис «ні до кого»
    third = await client.post("/appointments/lock", json={"business_id": bid, "service_id": sid, "start_time": _at(day, 12), "master_id": "0", "session_token": "s0003"})
    assert third.status_code == 409


@pytest.mark.asyncio
async def test_any_master_balances_by_daily_load(client, auth_headers):
    bid, sid, (m0, m1), owner, day = await _setup(client, auth_headers, "load")
    first = (await _book(client, bid, sid, _at(day, 10), "l0001")).json()
    busy = await _master_of(first["id"])
    second = (await _book(client, bid, sid, _at(day, 15), "l0002")).json()
    assert await _master_of(second["id"]) != busy, "другий запис за день іде до менш завантаженого майстра"


@pytest.mark.asyncio
async def test_any_master_skips_day_off_and_unassigned_service(client, auth_headers):
    bid, sid, (m0, m1), owner, day = await _setup(client, auth_headers, "skip")
    # m0 має вихідний, m1 - не виконує цю послугу: нікого немає
    week = [{"active": True, "start": "09:00", "end": "20:00"} for _ in range(7)]
    week[day.weekday()] = {"active": False, "start": "09:00", "end": "20:00"}
    assert (await client.patch(f"/crm/staff/{m0}?business_id={bid}", json={"shifts": week}, headers=owner)).status_code == 200
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("UPDATE users SET assigned_services = '[999]'::json WHERE id=$1", m1)
    finally:
        await conn.close()
    free = await client.get("/appointments/available-slots", params={"business_id": bid, "service_id": sid, "target_date": day.isoformat(), "master_id": "0"})
    assert not [s for s in free.json()["slots"] if s["status"] == "available"], "слоти не показуються, коли ніхто не підходить"
    lock = await client.post("/appointments/lock", json={"business_id": bid, "service_id": sid, "start_time": _at(day, 12), "master_id": "0", "session_token": "k0001"})
    assert lock.status_code == 409
    # повертаємо m1 послугу - тепер записатись можна, і саме до нього
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("UPDATE users SET assigned_services = $1::json WHERE id=$2", f"[{sid}]", m1)
    finally:
        await conn.close()
    r = (await _book(client, bid, sid, _at(day, 12), "k0002")).json()
    assert await _master_of(r["id"]) == m1


@pytest.mark.asyncio
async def test_any_master_ignores_personal_time_off(client, auth_headers):
    bid, sid, (m0, m1), owner, day = await _setup(client, auth_headers, "off")
    conn = await asyncpg.connect(DB)
    try:  # особистий час m0 на 12:00-13:00
        await conn.execute(
            "INSERT INTO appointments (business_id, master_id, start_time, end_time, status, source, created_at) VALUES ($1,$2,$3,$4,'time_off','direct',now())",
            bid, m0, __import__("datetime").datetime.fromisoformat(_at(day, 12)), __import__("datetime").datetime.fromisoformat(_at(day, 13)))
    finally:
        await conn.close()
    r = (await _book(client, bid, sid, _at(day, 12), "t0001")).json()
    assert await _master_of(r["id"]) == m1, "майстер в особистому часі не отримує запис"


@pytest.mark.asyncio
async def test_lock_then_confirm_keeps_addons_and_extends_visit(client, auth_headers):
    bid, sid, (m0,), owner, day = await _setup(client, auth_headers, "addon", masters=1)
    add = (await client.post("/services", json={"business_id": bid, "name": "Догляд", "duration_minutes": 30, "price": 100}, headers=owner)).json()["id"]
    await client.patch(f"/services/{sid}", json={"addon_service_ids": [add]}, headers=owner)
    start = _at(day, 11)
    await client.post("/appointments/lock", json={"business_id": bid, "service_id": sid, "start_time": start, "master_id": "0", "session_token": "a0001"})
    r = await client.post("/appointments", json={
        "business_id": bid, "service_id": sid, "addon_service_ids": [add], "start_time": start, "master_id": "0", "session_token": "a0001",
        "client_name": "Клієнт", "client_phone": "+380670000001", "client_email": "a@t.com"})
    assert r.status_code == 200, r.text
    conn = await asyncpg.connect(DB)
    try:
        row = await conn.fetchrow("SELECT start_time, end_time, addon_service_ids FROM appointments WHERE id=$1", r.json()["id"])
    finally:
        await conn.close()
    assert int((row["end_time"] - row["start_time"]).total_seconds() // 60) == 90, "візит триває з урахуванням додаткової послуги"
    assert row["addon_service_ids"], "додаткова послуга лишається в записі"
