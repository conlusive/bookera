"""Підтвердження записів: заклад обирає автоматично чи вручну; клієнт отримує правдивий лист на кожному кроці."""
from datetime import datetime, timedelta, timezone

import pytest

from app.core import email as email_module


def _slot(days=2, hour=10):
    return (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=days)).replace(hour=hour, minute=0, second=0, microsecond=0).isoformat()


@pytest.fixture
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(email_module, "send_email_sync", lambda to, subject, html: sent.append((to, subject, html)))
    return sent


async def _salon(client, h, auto_approve):
    bid = (await client.post("/crm/businesses", json={"name": "Appr", "city": "Львів"}, headers=h)).json()["id"]
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 30, "price": 500}, headers=h)).json()["id"]
    r = await client.patch(f"/crm/businesses/{bid}", json={"notification_settings": {"auto_approve": auto_approve}}, headers=h)
    assert r.status_code == 200, r.text
    return bid, sid


async def _book(client, bid, sid, start, session="ap1", email="klient@t.com"):
    r = await client.post("/appointments", json={
        "business_id": bid, "service_id": sid, "start_time": start, "session_token": session,
        "client_name": "Клієнт", "client_phone": "+380671119090", "client_email": email})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.asyncio
async def test_auto_mode_confirms_at_once_and_says_so(client, auth_headers, outbox):
    h = auth_headers("appr-1")
    bid, sid = await _salon(client, h, auto_approve=True)
    a = await _book(client, bid, sid, _slot())
    assert a["status"] == "confirmed"
    assert any("Запис підтверджено" in subj for to, subj, _html in outbox if to == "klient@t.com")


@pytest.mark.asyncio
async def test_manual_mode_asks_to_wait_then_approval_and_decline_are_emailed(client, auth_headers, outbox):
    h = auth_headers("appr-2")
    bid, sid = await _salon(client, h, auto_approve=False)
    a = await _book(client, bid, sid, _slot())
    assert a["status"] == "pending_approval"
    to_client = [subj for to, subj, _ in outbox if to == "klient@t.com"]
    assert to_client and "Запит на запис отримано" in to_client[0] and not any("Запис підтверджено" in s for s in to_client), "не обіцяємо підтвердження, якого ще немає"

    ok = await client.patch(f"/appointments/{a['id']}/status", json={"status": "confirmed"}, headers=h)
    assert ok.status_code == 200 and ok.json()["status"] == "confirmed"
    assert any("Запис підтверджено" in subj for to, subj, _ in outbox if to == "klient@t.com")

    b = await _book(client, bid, sid, _slot(3), session="ap2")
    no = await client.patch(f"/appointments/{b['id']}/status", json={"status": "cancelled"}, headers=h)
    assert no.status_code == 200
    assert any("Запис не підтверджено" in subj for to, subj, _ in outbox if to == "klient@t.com")


@pytest.mark.asyncio
async def test_no_client_email_when_notifications_are_off(client, auth_headers, outbox):
    h = auth_headers("appr-3")
    bid, sid = await _salon(client, h, auto_approve=False)
    await client.patch(f"/crm/businesses/{bid}", json={"notification_settings": {"auto_approve": False, "notify_client_booking": False}}, headers=h)
    a = await _book(client, bid, sid, _slot())
    await client.patch(f"/appointments/{a['id']}/status", json={"status": "confirmed"}, headers=h)
    assert [x for x in outbox if x[0] == "klient@t.com"] == []


@pytest.mark.asyncio
async def test_pending_request_holds_the_slot(client, auth_headers, outbox):
    h = auth_headers("appr-4")
    bid, sid = await _salon(client, h, auto_approve=False)
    start = _slot()
    await _book(client, bid, sid, start)
    day = start[:10]
    slots = (await client.get("/appointments/available-slots", params={"business_id": bid, "service_id": sid, "target_date": day})).json()["slots"]
    taken = [s for s in slots if s["time"][:5] == start[11:16]]
    assert taken and taken[0]["status"] != "available", "запит, що чекає відповіді, тримає час"
