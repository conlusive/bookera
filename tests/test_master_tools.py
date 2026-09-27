import asyncpg
import pytest
from datetime import datetime, timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _setup(client, auth_headers, tag):
    owner = auth_headers(f"tl-owner-{tag}")
    bid = (await client.post("/crm/businesses", json={"name": "Tools", "city": "Львів", "email": f"salon-{tag}@example.com"}, headers=owner)).json()["id"]
    await client.put(f"/crm/businesses/{bid}/hours", json=[
        {"weekday": d, "is_closed": False, "is_open": True, "open_time": "09:00", "close_time": "20:00"} for d in range(7)
    ], headers=owner)
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 500},
                             headers=owner)).json()["id"]
    m = f"tl-m-{tag}"
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("INSERT INTO users (id, email, full_name, role, is_active, created_at, business_id) VALUES ($1,$2,'Олена',  'master',true,now(),$3)",
                           m, f"{m}@example.com", bid)
        await conn.execute("INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at) VALUES ($1,$2,'master',true,now())", m, bid)
    finally:
        await conn.close()
    return bid, sid, m, auth_headers(m), owner


async def _book(bid, sid, m, start, status="confirmed", phone="+380671112233", name="Марія", email=None, price=500):
    conn = await asyncpg.connect(DB)
    try:
        return await conn.fetchval(
            "INSERT INTO appointments (business_id, service_id, master_id, start_time, end_time, status, price, client_name, client_phone, client_email, manage_token, source) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'online') RETURNING id",
            bid, sid, m, start, start + timedelta(hours=1), status, price, name, phone, email, f"tok-{bid}-{start.isoformat()}")
    finally:
        await conn.close()


async def _free(client, bid, sid, m, day):
    r = await client.get("/appointments/available-slots", params={"business_id": bid, "service_id": sid, "target_date": day.isoformat(), "master_id": m})
    return {s["time"][:5] for s in r.json()["slots"] if s["status"] == "available"}


# ---------------------------------------------------------------- запити

@pytest.mark.asyncio
async def test_schedule_request_applied_on_approval(client, auth_headers):
    bid, sid, m, me, owner = await _setup(client, auth_headers, "sch")
    week = [{"active": True, "start": "12:00", "end": "16:00"} for _ in range(7)]
    r = await client.post("/work/me/requests", json={"business_id": bid, "kind": "schedule", "shifts": week, "comment": "Навчання вранці"}, headers=me)
    assert r.status_code == 200, r.text
    rid = r.json()["id"]

    inbox = (await client.get(f"/crm/businesses/{bid}/staff-requests", headers=owner)).json()
    assert [x["id"] for x in inbox] == [rid] and inbox[0]["staff_name"] == "Олена"

    r = await client.post(f"/crm/businesses/{bid}/staff-requests/{rid}/decide", json={"approve": True}, headers=owner)
    assert r.status_code == 200 and r.json()["status"] == "approved"

    day = (local_now() + timedelta(days=1)).date()
    free = await _free(client, bid, sid, m, day)
    assert free and min(free) >= "12:00" and max(free) <= "15:00", "погоджений графік застосовано"


@pytest.mark.asyncio
async def test_time_off_blocks_days_and_reports_conflicts(client, auth_headers):
    bid, sid, m, me, owner = await _setup(client, auth_headers, "vac")
    d1 = (local_now() + timedelta(days=3)).date()
    d2 = d1 + timedelta(days=1)
    await _book(bid, sid, m, datetime.combine(d1, datetime.min.time()).replace(hour=11))

    r = await client.post("/work/me/requests", json={"business_id": bid, "kind": "time_off", "date_from": d1.isoformat(), "date_to": d2.isoformat(), "reason": "sick"}, headers=me)
    rid = r.json()["id"]
    inbox = (await client.get(f"/crm/businesses/{bid}/staff-requests", headers=owner)).json()
    assert len(inbox[0]["conflicts"]) == 1, "власник одразу бачить запис, який треба перенести"

    r = await client.post(f"/crm/businesses/{bid}/staff-requests/{rid}/decide", json={"approve": True}, headers=owner)
    assert r.status_code == 200, r.text
    assert len(r.json()["conflicts"]) == 1
    assert await _free(client, bid, sid, m, d1) == set(), "день закрито для запису"
    assert await _free(client, bid, sid, m, d2) == set()
    assert await _free(client, bid, sid, m, d2 + timedelta(days=1)), "наступний день - вільний"


@pytest.mark.asyncio
async def test_declined_request_changes_nothing(client, auth_headers):
    bid, sid, m, me, owner = await _setup(client, auth_headers, "dec")
    d1 = (local_now() + timedelta(days=2)).date()
    rid = (await client.post("/work/me/requests", json={"business_id": bid, "kind": "time_off", "date_from": d1.isoformat(), "date_to": d1.isoformat()}, headers=me)).json()["id"]
    await client.post(f"/crm/businesses/{bid}/staff-requests/{rid}/decide", json={"approve": False, "note": "Цього дня багато записів"}, headers=owner)
    assert await _free(client, bid, sid, m, d1)
    mine = (await client.get("/work/me/requests", params={"business_id": bid}, headers=me)).json()
    assert mine[0]["status"] == "declined" and mine[0]["response_note"] == "Цього дня багато записів"


@pytest.mark.asyncio
async def test_request_rules(client, auth_headers):
    bid, sid, m, me, owner = await _setup(client, auth_headers, "rul")
    past = (local_now() - timedelta(days=1)).date().isoformat()
    assert (await client.post("/work/me/requests", json={"business_id": bid, "kind": "time_off", "date_from": past, "date_to": past}, headers=me)).status_code == 400
    # майстер не може погодити сам собі
    d = (local_now() + timedelta(days=2)).date().isoformat()
    rid = (await client.post("/work/me/requests", json={"business_id": bid, "kind": "time_off", "date_from": d, "date_to": d}, headers=me)).json()["id"]
    assert (await client.post(f"/crm/businesses/{bid}/staff-requests/{rid}/decide", json={"approve": True}, headers=me)).status_code == 403
    # відкликати можна, поки не розглянуто
    assert (await client.delete(f"/work/me/requests/{rid}", headers=me)).status_code == 204
    assert (await client.delete(f"/work/me/requests/{rid}", headers=me)).status_code == 409


# ---------------------------------------------------------------- клієнти

@pytest.mark.asyncio
async def test_my_clients_aggregated_with_hints(client, auth_headers):
    bid, sid, m, me, owner = await _setup(client, auth_headers, "cli")
    base = local_now().replace(tzinfo=None, microsecond=0)
    # постійна клієнтка: 3 візити, остання 10 днів тому, наступний запис є
    for d in (70, 40, 10):
        await _book(bid, sid, m, base - timedelta(days=d), "completed", phone="+380671112233", name="Марія")
    await _book(bid, sid, m, base + timedelta(days=5), "confirmed", phone="+380671112233", name="Марія")
    # давно не була: один візит 60 днів тому, наступного немає
    await _book(bid, sid, m, base - timedelta(days=60), "completed", phone="+380509998877", name="Ірина")
    conn = await asyncpg.connect(DB)
    try:
        bday = (base + timedelta(days=4)).date().replace(year=1995)
        await conn.execute("INSERT INTO clients (business_id, name, phone, birthday, formulas, is_blacklisted, consent_photo) VALUES ($1,'Марія','+380671112233',$2,'7.1 + 6%',false,false)", bid, bday)
    finally:
        await conn.close()

    rows = {c["name"]: c for c in (await client.get("/work/me/clients", params={"business_id": bid}, headers=me)).json()}
    assert rows["Марія"]["visits"] == 3 and rows["Марія"]["spent"] == 1500
    assert rows["Марія"]["next_visit"] and not rows["Марія"]["lapsed"]
    assert rows["Марія"]["birthday_in"] == 4 and rows["Марія"]["formulas"] == "7.1 + 6%"
    assert rows["Ірина"]["lapsed"] is True


# ---------------------------------------------------------------- портфоліо

@pytest.mark.asyncio
async def test_portfolio_visible_on_salon_page(client, auth_headers):
    bid, sid, m, me, owner = await _setup(client, auth_headers, "pf")
    r = await client.post("/work/me/portfolio", json={"business_id": bid, "image_url": "https://x.supabase.co/a.jpg", "caption": "Фейд"}, headers=me)
    assert r.status_code == 200
    assert (await client.post("/work/me/portfolio", json={"business_id": bid, "image_url": "http://evil/a.jpg"}, headers=me)).status_code == 400
    pub = (await client.get(f"/public/businesses/{bid}/portfolio")).json()
    assert pub[0]["name"] == "Олена" and pub[0]["items"][0]["caption"] == "Фейд"
    assert (await client.delete(f"/work/me/portfolio/{r.json()['id']}", headers=owner)).status_code == 404, "чуже не видалити"
    assert (await client.delete(f"/work/me/portfolio/{r.json()['id']}", headers=me)).status_code == 204


# ---------------------------------------------------------------- сповіщення

@pytest.mark.asyncio
async def test_client_cancel_notifies_master_and_salon(client, auth_headers, monkeypatch):
    """Раніше про скасування клієнтом не дізнавався ніхто."""
    sent = []

    async def fake(to, business_name, title, rows, footer=""):
        sent.append((to, title))
    import app.core.email as email_mod
    monkeypatch.setattr(email_mod, "send_staff_notice", fake)

    bid, sid, m, me, owner = await _setup(client, auth_headers, "ntf")
    start = (local_now() + timedelta(days=2)).replace(tzinfo=None, hour=11, minute=0, second=0, microsecond=0)
    aid = await _book(bid, sid, m, start)
    r = await client.post(f"/appointments/{aid}/cancel", json={"token": f"tok-{bid}-{start.isoformat()}"})
    assert r.status_code == 200, r.text
    assert {t for t, _ in sent} == {"salon-ntf@example.com", "tl-m-ntf@example.com"}
    assert all(title == "Клієнт скасував запис" for _, title in sent)
