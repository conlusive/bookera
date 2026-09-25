import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"
EMAIL = "wallet-client@example.com"


async def _visit(client, owner_headers, price=1000, email=EMAIL):
    r = await client.post("/crm/businesses", json={"name": "Wallet Salon", "city": "Львів"}, headers=owner_headers)
    bid = r.json()["id"]
    r = await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": price}, headers=owner_headers)
    sid = r.json()["id"]
    start = local_now().replace(tzinfo=None, microsecond=0) - timedelta(days=1)
    conn = await asyncpg.connect(DB)
    try:
        aid = await conn.fetchval(
            """INSERT INTO appointments (business_id, service_id, start_time, end_time, status, price,
                                         client_name, client_email, manage_token, source)
               VALUES ($1, $2, $3, $4, 'confirmed', $5, 'Клієнт', $6, $7, 'online') RETURNING id""",
            bid, sid, start, start + timedelta(hours=1), price, email, f"t-{bid}",
        )
    finally:
        await conn.close()
    return bid, aid


async def _set_status(client, headers, aid, status):
    return await client.patch(f"/crm/appointments/{aid}", json={"status": status}, headers=headers)


async def _client_headers(auth_headers, uid):
    """Клієнт із поштою EMAIL - щоб гаманець знайшов його візити."""
    h = auth_headers(uid)
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute(
            """INSERT INTO users (id, email, role, is_active, created_at) VALUES ($1, $2, 'client', true, now())
               ON CONFLICT (id) DO UPDATE SET email = $2""",
            uid, EMAIL,
        )
    finally:
        await conn.close()
    return h


@pytest.mark.asyncio
async def test_completed_visit_accrues_three_percent(client, auth_headers):
    owner = auth_headers("w-owner-1")
    bid, aid = await _visit(client, owner, price=1000)
    r = await _set_status(client, owner, aid, "completed")
    assert r.status_code == 200, r.text

    me = await _client_headers(auth_headers, "w-client-1")
    w = (await client.get("/wallet/my", headers=me)).json()
    assert w["bonus_balance"] == 30, "3% від 1000 ₴"
    assert w["bonus_history"][0]["reason"] == "visit_completed"


@pytest.mark.asyncio
async def test_uncompleting_reverses_bonus(client, auth_headers):
    """Позначку «завершено» зняли - бонус повертається окремим записом."""
    owner = auth_headers("w-owner-2")
    bid, aid = await _visit(client, owner, price=500)
    await _set_status(client, owner, aid, "completed")
    await _set_status(client, owner, aid, "confirmed")

    me = await _client_headers(auth_headers, "w-client-2")
    w = (await client.get("/wallet/my", headers=me)).json()
    assert w["bonus_balance"] == 0
    assert {h["reason"] for h in w["bonus_history"]} == {"visit_completed", "visit_reversed"}


@pytest.mark.asyncio
async def test_completing_twice_does_not_double(client, auth_headers):
    owner = auth_headers("w-owner-3")
    bid, aid = await _visit(client, owner, price=1000)
    await _set_status(client, owner, aid, "completed")
    await _set_status(client, owner, aid, "confirmed")
    await _set_status(client, owner, aid, "completed")

    me = await _client_headers(auth_headers, "w-client-3")
    assert (await client.get("/wallet/my", headers=me)).json()["bonus_balance"] == 0, \
        "після повернення повторне завершення не нараховує вдруге"


@pytest.mark.asyncio
async def test_buy_gift_card_mock_payment(client, auth_headers):
    """Тестова оплата підтверджується одразу - картка активна, код видно."""
    owner = auth_headers("w-owner-4")
    bid, _ = await _visit(client, owner)
    me = await _client_headers(auth_headers, "w-buyer-4")

    r = await client.post("/wallet/gift-cards", headers=me, json={
        "business_id": bid, "amount": 1000, "recipient_name": "Мама", "recipient_email": "mom@example.com",
    })
    assert r.status_code == 200, r.text
    card = r.json()["card"]
    assert card["status"] == "active" and card["code"], "після оплати - активна з кодом"

    w = (await client.get("/wallet/my", headers=me)).json()
    assert any(c["id"] == card["id"] and c["direction"] == "bought" for c in w["gift_cards"])


@pytest.mark.asyncio
async def test_gift_card_amount_limits(client, auth_headers):
    owner = auth_headers("w-owner-5")
    bid, _ = await _visit(client, owner)
    me = await _client_headers(auth_headers, "w-buyer-5")
    for bad in (50, 50000):
        r = await client.post("/wallet/gift-cards", headers=me, json={"business_id": bid, "amount": bad})
        assert r.status_code == 422


@pytest.mark.asyncio
async def test_callback_checks_amount_and_is_idempotent(client, auth_headers):
    """
    Справжня оплата: картка чекає підтвердження. Сума має збігатися з
    виставленою - оплату на 1 гривню не можна видати за повну.
    """
    owner = auth_headers("w-owner-6")
    bid, _ = await _visit(client, owner)
    conn = await asyncpg.connect(DB)
    try:
        pid = await conn.fetchval(
            """INSERT INTO payments (business_id, purpose, amount, currency, provider, provider_ref, status)
               VALUES ($1, 'gift_certificate_purchase', 1000, 'UAH', 'wayforpay', 'gc-test-cb', 'pending') RETURNING id""", bid)
        cid = await conn.fetchval(
            """INSERT INTO gift_certificates (business_id, code, initial_amount, remaining_amount, status, payment_id)
               VALUES ($1, 'CBTEST01', 1000, 1000, 'pending', $2) RETURNING id""", bid, pid)
    finally:
        await conn.close()

    r = await client.post("/wallet/gift-cards/callback", json={"orderReference": "gc-test-cb", "amount": 1, "transactionStatus": "Approved"})
    assert r.status_code == 400, "сума 1 ₴ замість 1000 - відхилено"

    r = await client.post("/wallet/gift-cards/callback", json={"orderReference": "gc-test-cb", "amount": 1000, "transactionStatus": "Approved"})
    assert r.json()["status"] == "ok"
    r = await client.post("/wallet/gift-cards/callback", json={"orderReference": "gc-test-cb", "amount": 1000, "transactionStatus": "Approved"})
    assert r.json()["status"] == "already_processed"

    conn = await asyncpg.connect(DB)
    try:
        assert await conn.fetchval("SELECT status FROM gift_certificates WHERE id = $1", cid) == "active"
    finally:
        await conn.close()
