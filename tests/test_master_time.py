import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _setup(client, auth_headers, tag):
    owner = auth_headers(f"mt-owner-{tag}")
    bid = (await client.post("/crm/businesses", json={"name": "Time", "city": "Львів"}, headers=owner)).json()["id"]
    await client.put(f"/crm/businesses/{bid}/hours", json=[
        {"weekday": d, "is_closed": False, "is_open": True, "open_time": "09:00", "close_time": "20:00"} for d in range(7)
    ], headers=owner)
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 500},
                             headers=owner)).json()["id"]
    m = f"mt-m-{tag}"
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("INSERT INTO users (id, email, role, is_active, created_at, business_id) VALUES ($1,$2,'master',true,now(),$3)",
                           m, f"{m}@example.com", bid)
        await conn.execute("INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at) VALUES ($1,$2,'master',true,now())", m, bid)
    finally:
        await conn.close()
    tomorrow = (local_now() + timedelta(days=1)).date()
    return bid, sid, m, auth_headers(m), tomorrow, owner


async def _free(client, bid, sid, master, day):
    r = await client.get("/appointments/available-slots", params={
        "business_id": bid, "service_id": sid, "target_date": day.isoformat(), "master_id": master})
    return {s["time"][:5] for s in r.json()["slots"] if s["status"] == "available"}


@pytest.mark.asyncio
async def test_day_off_closes_booking(client, auth_headers):
    """
    Раніше графік майстра на сервері не враховувався: до нього можна
    було записатись навіть у вихідний.
    """
    bid, sid, m, me, day, owner = await _setup(client, auth_headers, "off")
    week = [{"active": True, "start": "09:00", "end": "20:00"} for _ in range(7)]
    week[day.weekday()] = {"active": False, "start": "09:00", "end": "20:00"}
    # Графік виставляє САЛОН у «Команді» - тим самим маршрутом, що кабінет.
    assert (await client.patch(f"/crm/staff/{m}?business_id={bid}", json={"shifts": week}, headers=owner)).status_code == 200
    assert await _free(client, bid, sid, m, day) == set(), "у вихідний - жодної вільної години"


@pytest.mark.asyncio
async def test_shift_limits_hours(client, auth_headers):
    bid, sid, m, me, day, owner = await _setup(client, auth_headers, "shift")
    week = [{"active": True, "start": "12:00", "end": "16:00"} for _ in range(7)]
    await client.patch(f"/crm/staff/{m}?business_id={bid}", json={"shifts": week}, headers=owner)
    free = await _free(client, bid, sid, m, day)
    assert free and min(free) >= "12:00" and max(free) <= "15:00", "лише в межах зміни, послуга 60 хв"


@pytest.mark.asyncio
async def test_time_off_blocks_and_can_be_removed(client, auth_headers):
    bid, sid, m, me, day, owner = await _setup(client, auth_headers, "off2")
    start = f"{day.isoformat()}T13:00:00"
    r = await client.post("/work/me/time-off", json={"business_id": bid, "start_time": start,
                                                     "end_time": f"{day.isoformat()}T15:00:00", "note": "Лікар"}, headers=me)
    assert r.status_code == 200, r.text
    free = await _free(client, bid, sid, m, day)
    assert "13:00" not in free and "14:00" not in free and "15:00" in free

    agenda = (await client.get("/work/me/agenda", params={"business_id": bid, "date": day.isoformat()}, headers=me)).json()
    assert any(a["status"] == "time_off" and a["client_name"] == "Лікар" for a in agenda)

    assert (await client.delete(f"/work/me/time-off/{r.json()['id']}", headers=me)).status_code == 204
    assert "13:00" in await _free(client, bid, sid, m, day)


@pytest.mark.asyncio
async def test_time_off_cannot_cover_client_booking(client, auth_headers):
    """Особистий час не перекриває клієнта: спершу перенести запис."""
    bid, sid, m, me, day, owner = await _setup(client, auth_headers, "clash")
    conn = await asyncpg.connect(DB)
    try:
        from datetime import datetime
        st = datetime.combine(day, datetime.min.time()).replace(hour=14)
        await conn.execute("INSERT INTO appointments (business_id, service_id, master_id, start_time, end_time, status, source) "
                           "VALUES ($1,$2,$3,$4,$5,'confirmed','online')", bid, sid, m, st, st + timedelta(hours=1))
    finally:
        await conn.close()
    r = await client.post("/work/me/time-off", json={"business_id": bid, "start_time": f"{day}T13:00:00", "end_time": f"{day}T16:00:00"}, headers=me)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_pending_booking_holds_time(client, auth_headers):
    """Запис, що чекає підтвердження, теж тримає час - раніше не тримав."""
    bid, sid, m, me, day, owner = await _setup(client, auth_headers, "pend")
    conn = await asyncpg.connect(DB)
    try:
        from datetime import datetime
        st = datetime.combine(day, datetime.min.time()).replace(hour=11)
        await conn.execute("INSERT INTO appointments (business_id, service_id, master_id, start_time, end_time, status, source) "
                           "VALUES ($1,$2,$3,$4,$5,'pending_approval','online')", bid, sid, m, st, st + timedelta(hours=1))
    finally:
        await conn.close()
    assert "11:00" not in await _free(client, bid, sid, m, day)


@pytest.mark.asyncio
async def test_stranger_cannot_read_agenda(client, auth_headers):
    bid, sid, m, me, day, owner = await _setup(client, auth_headers, "priv")
    r = await client.get("/work/me/agenda", params={"business_id": bid, "date": day.isoformat()}, headers=auth_headers("mt-outsider"))
    assert r.status_code == 403



@pytest.mark.asyncio
async def test_master_sees_salon_schedule_but_cannot_change_it(client, auth_headers):
    """Майстер бачить той самий графік, що виставив салон, але змінити сам не може."""
    bid, sid, m, me, day, owner = await _setup(client, auth_headers, "ro")
    week = [{"active": i < 5, "start": "11:00", "end": "19:00"} for i in range(7)]
    await client.patch(f"/crm/staff/{m}?business_id={bid}", json={"shifts": week}, headers=owner)

    r = (await client.get("/work/me/shifts", params={"business_id": bid}, headers=me)).json()
    assert r["source"] == "master"
    assert r["shifts"][0] == {"day": "Понеділок", "active": True, "start": "11:00", "end": "19:00"}
    assert r["shifts"][6]["active"] is False

    # Сам - не може: ні окремим маршрутом, ні через картку в «Команді»
    assert (await client.put("/work/me/shifts", json={"shifts": week}, headers=me)).status_code in (404, 405)
    await client.patch(f"/crm/staff/{m}", json={"shifts": [{"active": True, "start": "00:00", "end": "23:59"}] * 7}, headers=me)
    r2 = (await client.get("/work/me/shifts", params={"business_id": bid}, headers=me)).json()
    assert r2["shifts"][0]["start"] == "11:00", "графік не змінився"


@pytest.mark.asyncio
async def test_no_own_schedule_shows_salon_hours(client, auth_headers):
    """Власного графіка немає - майстер працює в години закладу, і бачить саме їх."""
    bid, sid, m, me, day, owner = await _setup(client, auth_headers, "salon")
    r = (await client.get("/work/me/shifts", params={"business_id": bid}, headers=me)).json()
    assert r["source"] == "salon"
    assert all(s["start"] == "09:00" and s["end"] == "20:00" for s in r["shifts"])


@pytest.mark.asyncio
async def test_two_salons_two_schedules(client, auth_headers):
    """
    Майстер у двох салонах - у кожному свій графік. Раніше графік
    зберігався за людиною, і салони перетирали один одному.
    """
    a_bid, a_sid, m, me, day, a_owner = await _setup(client, auth_headers, "twoA")
    b_owner = auth_headers("mt-owner-twoB")
    b_bid = (await client.post("/crm/businesses", json={"name": "Other", "city": "Львів"}, headers=b_owner)).json()["id"]
    await client.put(f"/crm/businesses/{b_bid}/hours", json=[
        {"weekday": d, "is_closed": False, "is_open": True, "open_time": "09:00", "close_time": "20:00"} for d in range(7)
    ], headers=b_owner)
    b_sid = (await client.post("/services", json={"business_id": b_bid, "name": "Стрижка", "duration_minutes": 60, "price": 500},
                               headers=b_owner)).json()["id"]
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at) VALUES ($1,$2,'master',true,now())", m, b_bid)
    finally:
        await conn.close()

    morning = [{"active": True, "start": "09:00", "end": "13:00"} for _ in range(7)]
    evening = [{"active": True, "start": "15:00", "end": "20:00"} for _ in range(7)]
    assert (await client.patch(f"/crm/staff/{m}?business_id={a_bid}", json={"shifts": morning}, headers=a_owner)).status_code == 200
    assert (await client.patch(f"/crm/staff/{m}?business_id={b_bid}", json={"shifts": evening}, headers=b_owner)).status_code == 200

    free_a = await _free(client, a_bid, a_sid, m, day)
    free_b = await _free(client, b_bid, b_sid, m, day)
    assert free_a and max(free_a) <= "12:00", "у салоні А - лише ранок"
    assert free_b and min(free_b) >= "15:00", "у салоні Б - лише вечір"

    ra = (await client.get("/work/me/shifts", params={"business_id": a_bid}, headers=me)).json()
    rb = (await client.get("/work/me/shifts", params={"business_id": b_bid}, headers=me)).json()
    assert ra["shifts"][0]["end"] == "13:00" and rb["shifts"][0]["start"] == "15:00"


@pytest.mark.asyncio
async def test_master_stays_in_team_after_switching(client, auth_headers):
    """Майстер перемкнувся в інший салон - у команді першого він лишається."""
    a_bid, a_sid, m, me, day, a_owner = await _setup(client, auth_headers, "stay")
    other = (await client.post("/crm/businesses", json={"name": "Інший", "city": "Львів"},
                               headers=auth_headers("mt-owner-stay-2"))).json()["id"]
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("UPDATE users SET business_id = $1 WHERE id = $2", other, m)
    finally:
        await conn.close()
    team = (await client.get(f"/crm/businesses/{a_bid}/staff", headers=a_owner)).json()
    assert m in {t["id"] for t in team}, "у команді першого салону лишається"
    assert await _free(client, a_bid, a_sid, m, day), "і до нього можна записатись"


@pytest.mark.asyncio
async def test_calendar_break_blocks_online_booking(client, auth_headers):
    """
    «Перерва» з календаря кабінету (is_block) - постійний блок без терміну
    дії. Клієнт не має змоги записатись на цей час онлайн.
    """
    bid, sid, m, me, day, owner = await _setup(client, auth_headers, "brk")
    r = await client.post("/crm/appointments", json={
        "business_id": bid, "master_id": m, "start_time": f"{day.isoformat()}T13:00:00",
        "duration_minutes": 60, "client_name": "Обід", "is_block": True,
    }, headers=owner)
    assert r.status_code in (200, 201), r.text
    free = await _free(client, bid, sid, m, day)
    assert "13:00" not in free and "12:30" not in free, "перерва закриває час"
    assert "14:00" in free
