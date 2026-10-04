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
async def test_review_request_sent_once_right_after(client, auth_headers, monkeypatch):
    sent = []

    async def fake(to, business_name, master_name, service_name, when_str, link_base):
        sent.append((to, master_name, link_base))
    import app.core.email as em
    monkeypatch.setattr(em, "send_review_request", fake)

    bid, sid, owner, m = await _setup(client, auth_headers, "req")
    # Лист - одразу після завершення (раніше чекали 2 години)
    ready, _ = await _done(bid, sid, m, 3)          # 3 год тому - так
    just, _ = await _done(bid, sid, m, 0)           # щойно - так, одразу
    await _done(bid, sid, m, 24 * 5)                # 5 днів тому - запізно

    from app.core.database import AsyncSessionLocal
    from app.services.reminders import send_review_requests
    async with AsyncSessionLocal() as db:
        assert await send_review_requests(db, "https://bookera.test") == 2
    assert {s[2].split("?")[0] for s in sent} == {f"https://bookera.test/my-booking/{ready}", f"https://bookera.test/my-booking/{just}"}
    assert all(s[1] == "Олена" for s in sent)
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


@pytest.mark.asyncio
async def test_separate_master_and_salon_ratings(client, auth_headers):
    """
    Майстер і заклад - окремо: майстер у свою якість, заклад - у рейтинг
    закладу. Тривога - якщо ХОЧ ОДНА низька.
    """
    bid, sid, owner, m = await _setup(client, auth_headers, "split")
    aid, token = await _done(bid, sid, m, 3)
    r = await client.post(f"/appointments/{aid}/review", json={"token": token, "master_rating": 5, "salon_rating": 2, "comment": "Майстер супер, але брудно"})
    assert r.status_code == 200, r.text
    assert r.json()["rating"] == 2.0, "рейтинг закладу - з оцінки закладу"

    q = (await client.get(f"/crm/businesses/{bid}/staff/{m}/quality", headers=owner)).json()
    assert q["rating"]["avg"] == 5, "якість майстра - з оцінки майстра"
    info = (await client.get(f"/appointments/{aid}/feedback", params={"token": token})).json()
    assert info["review"]["master_rating"] == 5 and info["review"]["salon_rating"] == 2
    assert info["price"] == 500 and info["tip"]["percents"] == [5, 10, 15]


@pytest.mark.asyncio
async def test_master_rating_required_when_master(client, auth_headers):
    bid, sid, owner, m = await _setup(client, auth_headers, "req2")
    aid, token = await _done(bid, sid, m, 3)
    r = await client.post(f"/appointments/{aid}/review", json={"token": token, "salon_rating": 5})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_review_email_immediately_when_master_completes(client, auth_headers, monkeypatch):
    """«Як вам візит?» - одразу, щойно майстер позначив завершеним, і лише раз."""
    sent = []

    async def fake(to, business_name, master_name, service_name, when_str, link_base):
        sent.append(to)
    import app.core.email as em
    monkeypatch.setattr(em, "send_review_request", fake)

    bid, sid, owner, m = await _setup(client, auth_headers, "now")
    end = local_now().replace(tzinfo=None, microsecond=0) - timedelta(minutes=5)
    conn = await asyncpg.connect(DB)
    try:
        aid = await conn.fetchval(
            "INSERT INTO appointments (business_id, service_id, master_id, start_time, end_time, status, price, client_name, client_email, manage_token, source) "
            "VALUES ($1,$2,$3,$4,$5,'confirmed',500,'Марія','now@example.com','tok-now','online') RETURNING id",
            bid, sid, m, end - timedelta(hours=1), end)
    finally:
        await conn.close()
    r = await client.patch(f"/crm/appointments/{aid}", json={"status": "completed"}, headers=owner)
    assert r.status_code == 200, r.text
    assert sent == ["now@example.com"]

    from app.core.database import AsyncSessionLocal
    from app.services.reminders import send_review_requests
    async with AsyncSessionLocal() as db:
        assert await send_review_requests(db, "https://bookera.test") == 0, "цикл не надсилає вдруге"

    log = (await client.get(f"/crm/businesses/{bid}/audit", params={"category": "bookings"}, headers=owner)).json()["items"]
    assert any("завершено" in e["summary"] for e in log), "зміна статусу - у журналі дій"


@pytest.mark.asyncio
async def test_calendar_route_also_sends_right_away(client, auth_headers, monkeypatch):
    """
    Календар кабінету змінює статус через /appointments/{id}/status - інший
    маршрут. Лист і журнал мають працювати й тут.
    """
    sent = []

    async def fake(to, *a):
        sent.append(to)
    import app.core.email as em
    monkeypatch.setattr(em, "send_review_request", fake)

    bid, sid, owner, m = await _setup(client, auth_headers, "cal")
    end = local_now().replace(tzinfo=None, microsecond=0) - timedelta(minutes=5)
    conn = await asyncpg.connect(DB)
    try:
        aid = await conn.fetchval(
            "INSERT INTO appointments (business_id, service_id, master_id, start_time, end_time, status, price, client_name, client_email, manage_token, source) "
            "VALUES ($1,$2,$3,$4,$5,'confirmed',500,'Марія','cal@example.com','tok-cal','online') RETURNING id",
            bid, sid, m, end - timedelta(hours=1), end)
    finally:
        await conn.close()
    r = await client.patch(f"/appointments/{aid}/status", json={"status": "completed"}, headers=owner)
    assert r.status_code == 200, r.text
    assert sent == ["cal@example.com"]
    log = (await client.get(f"/crm/businesses/{bid}/audit", params={"category": "bookings"}, headers=owner)).json()["items"]
    assert any("завершено" in e["summary"] for e in log)


@pytest.mark.asyncio
async def test_client_deletes_own_review(client, auth_headers):
    """Свій відгук - видалити можна; рейтинг перераховується; чужий - ні."""
    bid, sid, owner, m = await _setup(client, auth_headers, "del")
    a1, t1 = await _done(bid, sid, m, 3)
    a2, t2 = await _done(bid, sid, m, 4)
    await client.post(f"/appointments/{a1}/review", json={"token": t1, "master_rating": 5, "salon_rating": 1})
    await client.post(f"/appointments/{a2}/review", json={"token": t2, "master_rating": 5, "salon_rating": 5})

    assert (await client.delete(f"/appointments/{a1}/review", params={"token": t2})).status_code == 404, "чужий токен"
    r = await client.delete(f"/appointments/{a1}/review", params={"token": t1})
    assert r.status_code == 204
    reviews = (await client.get("/public/reviews", params={"business_id": bid})).json()
    assert [x["appointment_id"] for x in reviews] == [a2] and reviews[0]["salon_rating"] == 5
    slug_biz = (await client.get(f"/businesses/{bid}")).json()
    assert float(slug_biz["rating"]) == 5.0 and slug_biz["reviews_count"] == 1, "рейтинг без видаленого відгуку"
    # оцінити знову - можна
    assert (await client.post(f"/appointments/{a1}/review", json={"token": t1, "master_rating": 4, "salon_rating": 4})).status_code == 200
