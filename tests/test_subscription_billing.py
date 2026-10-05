"""
Підписка в «Налаштуваннях»: огляд, історія оплат і безпека підтвердження.
"""
import asyncpg
import pytest

from app.services import payments as payments_service
from app.services.payments import PaymentIntent

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _biz(client, auth_headers, tag):
    h = auth_headers(f"sb-{tag}")
    bid = (await client.post("/crm/businesses", json={"name": "Біл", "city": "Львів"}, headers=h)).json()["id"]
    return h, bid


async def _sql(query, *args):
    conn = await asyncpg.connect(DB)
    try:
        return await conn.fetch(query, *args)
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_overview_shows_trial_price_and_empty_history(client, auth_headers):
    h, bid = await _biz(client, auth_headers, "ov")
    r = await client.get("/platform/subscription", params={"business_id": bid}, headers=h)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "trial" and d["is_trial"] is True and d["days_left"] and d["has_access"] is True
    assert d["price_uah"] > 0 and d["period_days"] == 30 and d["payments"] == []


@pytest.mark.asyncio
async def test_only_the_owner_sees_the_subscription(client, auth_headers):
    h, bid = await _biz(client, auth_headers, "own")
    other = auth_headers("sb-intruder")
    await client.post("/crm/businesses", json={"name": "Чужий", "city": "Київ"}, headers=other)
    assert (await client.get("/platform/subscription", params={"business_id": bid}, headers=other)).status_code == 403


@pytest.mark.asyncio
async def test_test_payment_extends_and_appears_in_history(client, auth_headers):
    h, bid = await _biz(client, auth_headers, "mock")
    r = await client.post("/platform/subscription/checkout", params={"business_id": bid}, headers=h)
    assert r.status_code == 200 and r.json()["activated"] is True
    d = (await client.get("/platform/subscription", params={"business_id": bid}, headers=h)).json()
    assert d["status"] == "active" and d["is_trial"] is False
    assert [(p["status"], p["amount"]) for p in d["payments"]] == [("completed", d["price_uah"])]


@pytest.mark.asyncio
async def test_live_provider_never_activates_before_confirmation(client, auth_headers, monkeypatch):
    """Справжній WayForPay: форма оплати є, посилання немає. Раніше це сприймалось
    як «тестова оплата» й підписка продовжувалась безкоштовно."""
    h, bid = await _biz(client, auth_headers, "live")

    def live_intent(amount, order_id, product_name, return_url=None, client_email=None):
        i = PaymentIntent(provider="wayforpay", status="pending", checkout_url=None, provider_ref=order_id)
        i.checkout = {"action": "https://secure.wayforpay.com/pay", "fields": {"orderReference": order_id}}
        return i

    monkeypatch.setattr("app.api.platform.create_payment_intent", live_intent)
    r = await client.post("/platform/subscription/checkout", params={"business_id": bid}, headers=h)
    body = r.json()
    assert body["activated"] is False and body["checkout"]["action"].startswith("https://secure.wayforpay.com")
    d = (await client.get("/platform/subscription", params={"business_id": bid}, headers=h)).json()
    assert d["status"] == "trial" and d["payments"][0]["status"] == "pending"

    cb = {"orderReference": body["order_id"], "transactionStatus": "Approved", "amount": f"{body['amount']:.2f}"}
    for _ in range(2):
        assert (await client.post("/payments/wayforpay/callback", json=cb)).status_code == 200
    d = (await client.get("/platform/subscription", params={"business_id": bid}, headers=h)).json()
    assert d["status"] == "active" and [p["status"] for p in d["payments"]] == ["completed"]
    until = (await _sql("SELECT subscription_until FROM businesses WHERE id = $1", bid))[0][0]
    again = await client.post("/payments/wayforpay/callback", json=cb)
    assert (await _sql("SELECT subscription_until FROM businesses WHERE id = $1", bid))[0][0] == until, "повтор не продовжує вдруге"
    assert again.status_code == 200


@pytest.mark.asyncio
async def test_declined_or_wrong_amount_does_not_extend(client, auth_headers, monkeypatch):
    h, bid = await _biz(client, auth_headers, "bad")

    def live_intent(amount, order_id, product_name, return_url=None, client_email=None):
        i = PaymentIntent(provider="wayforpay", status="pending", checkout_url=None, provider_ref=order_id)
        i.checkout = {"action": "https://secure.wayforpay.com/pay", "fields": {}}
        return i

    monkeypatch.setattr("app.api.platform.create_payment_intent", live_intent)
    body = (await client.post("/platform/subscription/checkout", params={"business_id": bid}, headers=h)).json()

    r = await client.post("/payments/wayforpay/callback", json={"orderReference": body["order_id"], "transactionStatus": "Declined", "amount": f"{body['amount']:.2f}"})
    assert (await client.get("/platform/subscription", params={"business_id": bid}, headers=h)).json()["status"] == "trial"

    # нова спроба, але з іншою сумою
    body = (await client.post("/platform/subscription/checkout", params={"business_id": bid}, headers=h)).json()
    r = await client.post("/payments/wayforpay/callback", json={"orderReference": body["order_id"], "transactionStatus": "Approved", "amount": "1.00"})
    assert r.status_code == 400
    assert (await client.get("/platform/subscription", params={"business_id": bid}, headers=h)).json()["status"] == "trial"
