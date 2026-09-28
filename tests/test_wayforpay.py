import hashlib
import hmac
import json
from decimal import Decimal

import pytest

import app.services.payments as pay
from tests.test_feedback_tips import _setup, _done

SECRET = "test-wfp-secret"


def _sig(fields):
    return hmac.new(SECRET.encode(), ";".join(str(f) for f in fields).encode(), hashlib.md5).hexdigest()


@pytest.fixture
def live(monkeypatch):
    monkeypatch.setattr(pay, "WFP_MERCHANT_LOGIN", "bookera_test")
    monkeypatch.setattr(pay, "WFP_MERCHANT_SECRET", SECRET)
    monkeypatch.setattr(pay, "WFP_DOMAIN", "bookera.ua")
    monkeypatch.setattr(pay, "BACKEND_PUBLIC_URL", "https://api.bookera.ua")
    monkeypatch.setenv("FRONTEND_URL", "https://bookera.ua")


def _callback_body(order_id, amount, status="Approved"):
    data = {"merchantAccount": "bookera_test", "orderReference": order_id, "amount": amount, "currency": "UAH",
            "authCode": "541963", "cardPan": "41****8217", "transactionStatus": status, "reasonCode": 1100}
    data["merchantSignature"] = _sig([data[k] for k in ("merchantAccount", "orderReference", "amount", "currency",
                                                         "authCode", "cardPan", "transactionStatus", "reasonCode")])
    return data


@pytest.mark.asyncio
async def test_live_tip_builds_signed_form_not_a_link(client, auth_headers, live):
    """
    Раніше - посилання ?orderReference=…, з яким WayForPay не працює: гроші не
    списувались би ніколи. Тепер - повна підписана форма за документацією.
    """
    bid, sid, owner, m = await _setup(client, auth_headers, "wfp1")
    aid, token = await _done(bid, sid, m, 1)
    r = (await client.post(f"/appointments/{aid}/tip", json={"token": token, "amount": 65})).json()
    assert r["status"] == "pending" and r["checkout_url"] is None
    f = r["checkout"]["fields"]
    assert r["checkout"]["action"] == "https://secure.wayforpay.com/pay"
    assert f["amount"] == "65.00" and f["currency"] == "UAH" and f["productCount[]"] == "1"
    assert f["merchantSignature"] == _sig(["bookera_test", "bookera.ua", f["orderReference"], f["orderDate"],
                                           "65.00", "UAH", f["productName[]"], "1", "65.00"])
    assert f["serviceUrl"] == "https://api.bookera.ua/payments/wayforpay/callback"
    assert f["returnUrl"].startswith("https://api.bookera.ua/payments/return?to=%2Fmy-booking%2F")
    info = (await client.get(f"/appointments/{aid}/feedback", params={"token": token})).json()
    assert info["tip"]["live"] is True and info["tip"]["pending"] == 65 and info["tip"]["paid"] is None, "до підтвердження - не зараховано"


@pytest.mark.asyncio
async def test_callback_applies_once_and_answers_signed(client, auth_headers, live):
    bid, sid, owner, m = await _setup(client, auth_headers, "wfp2")
    aid, token = await _done(bid, sid, m, 1)
    order = (await client.post(f"/appointments/{aid}/tip", json={"token": token, "amount": 65})).json()["checkout"]["fields"]["orderReference"]

    # WayForPay шле JSON як ключ form-urlencoded - теж маємо зрозуміти
    raw = json.dumps(_callback_body(order, 65))
    r = await client.post("/payments/wayforpay/callback", content=raw, headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 200, r.text
    ans = r.json()
    assert ans["status"] == "accept" and ans["signature"] == _sig([order, "accept", ans["time"]]), "підписана відповідь"

    again = await client.post("/payments/wayforpay/callback", json=_callback_body(order, 65))
    assert again.json()["status"] == "accept"
    info = (await client.get(f"/appointments/{aid}/feedback", params={"token": token})).json()
    assert info["tip"]["paid"] == 65
    p = (await client.get(f"/crm/businesses/{bid}/staff/{m}/payout-preview", headers=owner)).json()
    assert float(p["tips_amount"]) == 65, "зараховано рівно один раз"


@pytest.mark.asyncio
async def test_callback_rejects_wrong_amount_and_signature(client, auth_headers, live):
    bid, sid, owner, m = await _setup(client, auth_headers, "wfp3")
    aid, token = await _done(bid, sid, m, 1)
    order = (await client.post(f"/appointments/{aid}/tip", json={"token": token, "amount": 65})).json()["checkout"]["fields"]["orderReference"]
    assert (await client.post("/payments/wayforpay/callback", json=_callback_body(order, 1))).status_code == 400, "1 ₴ замість 65"
    forged = _callback_body(order, 65); forged["merchantSignature"] = "0" * 32
    assert (await client.post("/payments/wayforpay/callback", json=forged)).status_code == 400
    declined = await client.post("/payments/wayforpay/callback", json=_callback_body(order, 65, "Declined"))
    assert declined.json()["status"] == "accept"
    info = (await client.get(f"/appointments/{aid}/feedback", params={"token": token})).json()
    assert info["tip"]["paid"] is None and info["tip"]["can_tip"] is True, "відхилену оплату можна повторити"


@pytest.mark.asyncio
async def test_return_redirect_only_to_our_site(client, live):
    r = await client.post("/payments/return", params={"to": "/my-booking/5?token=x&paid=1"}, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "https://bookera.ua/my-booking/5?token=x&paid=1"
    evil = await client.get("/payments/return", params={"to": "https://evil.example/phish"}, follow_redirects=False)
    assert evil.headers["location"] == "https://bookera.ua", "чужий сайт - на головну"


@pytest.mark.asyncio
async def test_payout_counts_visit_from_last_hours_once(client, auth_headers):
    """
    Візит годину тому - у поточній виплаті; після виплати - у наступну НЕ
    потрапляє. Раніше межі в UTC порівнювались із київським часом візитів.
    """
    bid, sid, owner, m = await _setup(client, auth_headers, "tz")
    await _done(bid, sid, m, 1)
    p1 = (await client.get(f"/crm/businesses/{bid}/staff/{m}/payout-preview", headers=owner)).json()
    assert p1["completed_appointments_count"] == 1, "візит годину тому - у виплаті"
    assert (await client.post(f"/crm/businesses/{bid}/staff/{m}/payouts", json={}, headers=owner)).status_code in (200, 201)
    p2 = (await client.get(f"/crm/businesses/{bid}/staff/{m}/payout-preview", headers=owner)).json()
    assert p2["completed_appointments_count"] == 0, "і не вдруге"
