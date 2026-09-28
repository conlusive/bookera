import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _setup(client, auth_headers, tag):
    owner = auth_headers(f"fb-owner-{tag}")
    bid = (await client.post("/crm/businesses", json={"name": "Feedback", "city": "Львів", "email": f"fb-{tag}@example.com"}, headers=owner)).json()["id"]
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 500}, headers=owner)).json()["id"]
    m = f"fb-m-{tag}"
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("INSERT INTO users (id, email, full_name, role, is_active, created_at, business_id, commission_rate, pay_configured_at) "
                           "VALUES ($1,$2,'Олена Коваль','master',true,now(),$3,40,now()-interval '30 days')", m, f"{m}@example.com", bid)
        await conn.execute("INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at) VALUES ($1,$2,'master',true,now())", m, bid)
    finally:
        await conn.close()
    return bid, sid, owner, m


async def _done(bid, sid, m, hours_ago, email="client@example.com", token=None):
    end = local_now().replace(tzinfo=None, microsecond=0) - timedelta(hours=hours_ago)
    token = token or f"fbt-{bid}-{hours_ago}"
    conn = await asyncpg.connect(DB)
    try:
        aid = await conn.fetchval(
            "INSERT INTO appointments (business_id, service_id, master_id, start_time, end_time, status, price, client_name, client_email, manage_token, source) "
            "VALUES ($1,$2,$3,$4,$5,'completed',500,'Марія',$6,$7,'online') RETURNING id",
            bid, sid, m, end - timedelta(hours=1), end, email, token)
    finally:
        await conn.close()
    return aid, token


@pytest.mark.asyncio
async def test_review_request_sent_once_and_on_time(client, auth_headers, monkeypatch):
    sent = []

    async def fake(to, business_name, master_name, service_name, when_str, link_base):
        sent.append((to, master_name, link_base))
    import app.core.email as em
    monkeypatch.setattr(em, "send_review_request", fake)

    bid, sid, owner, m = await _setup(client, auth_headers, "req")
    ready, _ = await _done(bid, sid, m, 3)          # 3 год тому - час
    await _done(bid, sid, m, 1)                     # 1 год тому - ще рано
    await _done(bid, sid, m, 24 * 5)                # 5 днів тому - запізно

    from app.core.database import AsyncSessionLocal
    from app.services.reminders import send_review_requests
    async with AsyncSessionLocal() as db:
        assert await send_review_requests(db, "https://bookera.test") == 1
    assert len(sent) == 1 and sent[0][1] == "Олена" and f"/my-booking/{ready}?token=" in sent[0][2]
    async with AsyncSessionLocal() as db:
        assert await send_review_requests(db, "https://bookera.test") == 0, "другий раз - не надсилаємо"


@pytest.mark.asyncio
async def test_tip_goes_to_master_payout(client, auth_headers):
    bid, sid, owner, m = await _setup(client, auth_headers, "tip")
    aid, token = await _done(bid, sid, m, 3)
    info = (await client.get(f"/appointments/{aid}/feedback", params={"token": token})).json()
    assert info["tip"]["can_tip"] is True and info["master_name"] == "Олена Коваль"

    r = await client.post(f"/appointments/{aid}/tip", json={"token": token, "amount": 100})
    assert r.status_code == 200 and r.json()["status"] == "completed", r.text
    again = await client.post(f"/appointments/{aid}/tip", json={"token": token, "amount": 100})
    assert again.status_code == 409, "один раз онлайн"

    info = (await client.get(f"/appointments/{aid}/feedback", params={"token": token})).json()
    assert info["tip"]["paid"] == 100 and info["tip"]["can_tip"] is False
    p = (await client.get(f"/crm/businesses/{bid}/staff/{m}/payout-preview", headers=owner)).json()
    assert float(p["tips_amount"]) == 100 and float(p["payout_amount"]) == 300, "40% від 500 + 100 чайових"


@pytest.mark.asyncio
async def test_tip_rules(client, auth_headers):
    bid, sid, owner, m = await _setup(client, auth_headers, "rul")
    aid, token = await _done(bid, sid, m, 3)
    assert (await client.post(f"/appointments/{aid}/tip", json={"token": "чужий", "amount": 100})).status_code == 404
    assert (await client.post(f"/appointments/{aid}/tip", json={"token": token, "amount": 5})).status_code == 422
    late, ltoken = await _done(bid, sid, m, 24 * 20)
    assert (await client.post(f"/appointments/{late}/tip", json={"token": ltoken, "amount": 100})).status_code == 409, "понад 14 днів"


@pytest.mark.asyncio
async def test_low_rating_alerts_owner(client, auth_headers, monkeypatch):
    sent = []

    async def fake(to, business_name, title, rows, footer=""):
        sent.append((to, title))
    import app.core.email as em
    monkeypatch.setattr(em, "send_staff_notice", fake)

    bid, sid, owner, m = await _setup(client, auth_headers, "low")
    aid, token = await _done(bid, sid, m, 3)
    r = await client.post(f"/appointments/{aid}/review", json={"token": token, "rating": 2, "comment": "Довго чекала"})
    assert r.status_code == 200, r.text
    assert sent == [("fb-low@example.com", "Низька оцінка візиту")]

    sent.clear()
    aid2, token2 = await _done(bid, sid, m, 4)
    await client.post(f"/appointments/{aid2}/review", json={"token": token2, "rating": 5})
    assert sent == [], "за добру оцінку - без тривоги"
