import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _setup(client, auth_headers, tag):
    h = auth_headers(f"cs-owner-{tag}")
    bid = (await client.post("/crm/businesses", json={"name": "Clients", "city": "Львів"}, headers=h)).json()["id"]
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 500}, headers=h)).json()["id"]
    return bid, sid, h


async def _appt(bid, sid, days_ago, status, client_id=None, phone=None, price=500, email=None):
    st = local_now().replace(tzinfo=None, microsecond=0) - timedelta(days=days_ago)
    conn = await asyncpg.connect(DB)
    try:
        return await conn.fetchval(
            "INSERT INTO appointments (business_id, service_id, client_id, client_phone, client_name, client_email, start_time, end_time, status, price, source) "
            "VALUES ($1,$2,$3,$4,'Марія',$5,$6,$7,$8,$9,'online') RETURNING id",
            bid, sid, client_id, phone, email, st, st + timedelta(hours=1), status, price)
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_stats_counted_from_appointments(client, auth_headers):
    """
    Раніше visits_count / total_spent / last_visit_at не оновлював ніхто: у всіх
    0 візитів і 0 ₴. Тепер - із записів, і за client_id, і за телефоном.
    """
    bid, sid, h = await _setup(client, auth_headers, "st")
    c = (await client.post("/crm/clients", json={"business_id": bid, "name": "Марія", "phone": "+380671112233"}, headers=h)).json()
    await _appt(bid, sid, 40, "completed", client_id=c["id"], price=500)
    await _appt(bid, sid, 10, "completed", phone="+38 (067) 111-22-33", price=700)   # старий онлайн-запис без client_id
    await _appt(bid, sid, 20, "no-show", client_id=c["id"])
    await _appt(bid, sid, -3, "confirmed", client_id=c["id"])                          # майбутній

    rows = {x["id"]: x for x in (await client.get("/crm/clients", params={"business_id": bid}, headers=h)).json()}
    s = rows[c["id"]]
    assert s["visits_count"] == 2 and s["total_spent"] == 1200 and s["no_show_count"] == 1
    assert s["last_visit_at"] and s["next_visit_at"], "і останній, і наступний візит"


@pytest.mark.asyncio
async def test_client_history_is_real(client, auth_headers):
    bid, sid, h = await _setup(client, auth_headers, "hist")
    c = (await client.post("/crm/clients", json={"business_id": bid, "name": "Ірина", "phone": "+380509998877"}, headers=h)).json()
    await _appt(bid, sid, 5, "completed", client_id=c["id"], price=650)
    await _appt(bid, sid, 30, "no-show", phone="+380509998877")
    hist = (await client.get(f"/crm/clients/{c['id']}/history", headers=h)).json()
    assert [x["status"] for x in hist] == ["completed", "no-show"], "новіші спершу"
    assert hist[0]["service"] == "Стрижка" and hist[0]["price"] == 650
    assert (await client.get(f"/crm/clients/{c['id']}/history", headers=auth_headers("cs-stranger"))).status_code in (403, 404)


@pytest.mark.asyncio
async def test_campaign_audiences_find_people(client, auth_headers):
    """
    «Постійні» (3+ візити) не знаходили нікого, «давно не були» падали на
    неіснуючому полі last_visit.
    """
    bid, sid, h = await _setup(client, auth_headers, "mkt")
    reg = (await client.post("/crm/clients", json={"business_id": bid, "name": "Постійна", "phone": "+380671000001", "email": "reg@example.com"}, headers=h)).json()
    for d in (10, 40, 70):
        await _appt(bid, sid, d, "completed", client_id=reg["id"])
    lost = (await client.post("/crm/clients", json={"business_id": bid, "name": "Давно", "phone": "+380671000002", "email": "lost@example.com"}, headers=h)).json()
    await _appt(bid, sid, 90, "completed", client_id=lost["id"])

    base = {"business_id": bid, "subject": "Привіт", "message": "Тестове повідомлення для розсилки клієнтам"}
    r = await client.post("/crm/campaigns", json={**base, "audience": "regular"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["queued"] == 1
    r = await client.post("/crm/campaigns", json={**base, "audience": "lapsed"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["queued"] == 1
