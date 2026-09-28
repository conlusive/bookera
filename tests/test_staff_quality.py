import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _setup(client, auth_headers, tag):
    owner = auth_headers(f"q-owner-{tag}")
    bid = (await client.post("/crm/businesses", json={"name": "Quality", "city": "Львів"}, headers=owner)).json()["id"]
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 500}, headers=owner)).json()["id"]
    conn = await asyncpg.connect(DB)
    try:
        for m in (f"q-m1-{tag}", f"q-m2-{tag}"):
            await conn.execute("INSERT INTO users (id, email, full_name, role, is_active, created_at, business_id, commission_rate, pay_configured_at) "
                               "VALUES ($1,$2,'Майстер','master',true,now(),$3,40,now()-interval '200 days')", m, f"{m}@example.com", bid)
            await conn.execute("INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at) VALUES ($1,$2,'master',true,now())", m, bid)
    finally:
        await conn.close()
    return bid, sid, owner, f"q-m1-{tag}", f"q-m2-{tag}"


async def _visit(bid, sid, master, days_ago, phone, status="completed", tip=None, rating=None, comment=None):
    st = local_now().replace(tzinfo=None, microsecond=0, second=0) - timedelta(days=days_ago)
    conn = await asyncpg.connect(DB)
    try:
        aid = await conn.fetchval(
            "INSERT INTO appointments (business_id, service_id, master_id, start_time, end_time, status, price, client_name, client_phone, tip_amount, source) "
            "VALUES ($1,$2,$3,$4,$5,$6,500,'Клієнт',$7,$8,'online') RETURNING id",
            bid, sid, master, st, st + timedelta(hours=1), status, phone, tip)
        if rating:
            await conn.execute("INSERT INTO reviews (business_id, appointment_id, author_name, rating, comment, created_at) VALUES ($1,$2,'Клієнт',$3,$4,now())",
                               bid, aid, rating, comment)
        return aid
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_quality_report_honest_retention(client, auth_headers):
    bid, sid, owner, m1, m2 = await _setup(client, auth_headers, "ret")
    # A: 80 днів тому, повернувся через 30 днів -> повернувся
    await _visit(bid, sid, m1, 80, "+380670000001", rating=5, comment="Чудово")
    await _visit(bid, sid, m1, 50, "+380670000001", tip=100)
    # B: 70 днів тому, не повертався 70 днів -> втрачений
    await _visit(bid, sid, m1, 70, "+380670000002", rating=4)
    # C: 10 днів тому, ще може повернутись -> НЕ рахується
    await _visit(bid, sid, m1, 10, "+380670000003", tip=50, rating=2, comment="Довго чекала")
    await _visit(bid, sid, m1, 5, "+380670000004")

    q = (await client.get(f"/crm/businesses/{bid}/staff/{m1}/quality", headers=owner)).json()
    assert q["visits"] == 5 and q["enough_data"] is True
    assert q["retention"]["eligible"] == 2 and q["retention"]["returned"] == 1 and q["retention"]["rate"] == 0.5, \
        "клієнт, у якого ще не минуло 60 днів, - не «втрачений»"
    assert q["tips"]["count"] == 2 and q["tips"]["total"] == 150 and q["tips"]["share"] == 0.4
    assert q["rating"]["avg"] == pytest.approx(3.67, abs=0.01) and q["rating"]["distribution"]["2"] == 1
    assert any(r["comment"] == "Довго чекала" for r in q["reviews"])
    # 0.5*((3.67-1)/4) + 0.35*0.5 + 0.15*0.4 = 0.3337+0.175+0.06 = 0.5687 -> 57
    assert q["score"] == 57


@pytest.mark.asyncio
async def test_too_few_visits_no_score(client, auth_headers):
    """На трьох візитах оцінка була б випадковою й несправедливою до нового майстра."""
    bid, sid, owner, m1, m2 = await _setup(client, auth_headers, "few")
    for i in range(3):
        await _visit(bid, sid, m1, 10 + i, f"+38067000010{i}", rating=5)
    q = (await client.get(f"/crm/businesses/{bid}/staff/{m1}/quality", headers=owner)).json()
    assert q["score"] is None and q["enough_data"] is False and q["rating"]["avg"] == 5


@pytest.mark.asyncio
async def test_master_sees_own_but_not_colleague_or_team(client, auth_headers):
    bid, sid, owner, m1, m2 = await _setup(client, auth_headers, "acc")
    me = auth_headers(m1, "master")
    r = await client.get(f"/crm/businesses/{bid}/staff/{m1}/quality", headers=me)
    assert r.status_code == 200 and "team" not in r.json(), "середнє команди майстрові не відкриваємо"
    assert (await client.get(f"/crm/businesses/{bid}/staff/{m2}/quality", headers=me)).status_code == 403
    assert (await client.get(f"/crm/businesses/{bid}/staff-quality", headers=me)).status_code == 403


@pytest.mark.asyncio
async def test_tips_recorded_and_paid_to_master(client, auth_headers):
    bid, sid, owner, m1, m2 = await _setup(client, auth_headers, "tip")
    aid = await _visit(bid, sid, m1, 2, "+380670000200")
    r = await client.patch(f"/crm/appointments/{aid}/tip", json={"amount": 120}, headers=owner)
    assert r.status_code == 200 and r.json()["tip_amount"] == 120
    p = (await client.get(f"/crm/businesses/{bid}/staff/{m1}/payout-preview", headers=owner)).json()
    assert float(p["tips_amount"]) == 120
    # 40% від 500 = 200 + 120 чайових
    assert float(p["payout_amount"]) == 320

    # за незавершений візит - ні; чужий майстер - ні
    future = await _visit(bid, sid, m1, -2, "+380670000201", status="confirmed")
    assert (await client.patch(f"/crm/appointments/{future}/tip", json={"amount": 50}, headers=owner)).status_code == 409
    assert (await client.patch(f"/crm/appointments/{aid}/tip", json={"amount": 999}, headers=auth_headers(m2, "master"))).status_code == 403


@pytest.mark.asyncio
async def test_team_scores_and_rank(client, auth_headers):
    bid, sid, owner, m1, m2 = await _setup(client, auth_headers, "rank")
    for i in range(5):
        await _visit(bid, sid, m1, 80 - i, f"+38067100000{i}", rating=5, tip=50)
        await _visit(bid, sid, m1, 20 - i, f"+38067100000{i}")
        await _visit(bid, sid, m2, 80 - i, f"+38067200000{i}", rating=3)
    team = {t["staff_id"]: t for t in (await client.get(f"/crm/businesses/{bid}/staff-quality", headers=owner)).json()}
    assert team[m1]["score"] > team[m2]["score"]
    q = (await client.get(f"/crm/businesses/{bid}/staff/{m1}/quality", headers=owner)).json()
    assert q["rank"] == 1 and q["ranked_of"] == 2 and q["team"]["score"] == team[m2]["score"]


@pytest.mark.asyncio
async def test_custom_period(client, auth_headers):
    """Довільний період: рахуються лише візити в ньому."""
    bid, sid, owner, m1, m2 = await _setup(client, auth_headers, "rng")
    for d in (40, 35, 32):
        await _visit(bid, sid, m1, d, f"+38067300000{d}", rating=5)
    await _visit(bid, sid, m1, 5, "+380673000099", rating=1)
    today = local_now().date()
    q = (await client.get(f"/crm/businesses/{bid}/staff/{m1}/quality",
                          params={"date_from": (today - timedelta(days=45)).isoformat(), "date_to": (today - timedelta(days=30)).isoformat()},
                          headers=owner)).json()
    assert q["visits"] == 3, "візит 5 днів тому - поза періодом"
    assert q["date_from"] == (today - timedelta(days=45)).isoformat()
    bad = await client.get(f"/crm/businesses/{bid}/staff/{m1}/quality", params={"date_from": today.isoformat(), "date_to": (today - timedelta(days=1)).isoformat()}, headers=owner)
    assert bad.status_code == 400
