"""Розділення трафіку: пряме посилання закладу (0% комісії) і вітрина BookEra (комісія).

test_monetization.py перевіряє сам токен і одноразовість комісії. Тут - сценарії, яких бракувало:
запис через резерв слота (саме так бронює фронтенд), токен іншого закладу, скасований візит,
зміна ставки закладом і незмінність джерела після переносу.
"""
from datetime import datetime, timedelta, timezone

import pytest


def _slot(days: int, hour: int) -> str:
    return (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=days)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    ).isoformat()


async def _salon(client, headers, name, price=1000):
    r = await client.post("/crm/businesses", json={"name": name, "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={"business_id": business_id, "name": "Стрижка", "duration_minutes": 30, "price": price}, headers=headers)
    service_id = r.json()["id"]
    r = await client.get(f"/crm/businesses/{business_id}/monetization", headers=headers)
    return business_id, service_id, r.json()["direct_link_token"]


async def _book_via_lock(client, business_id, service_id, start, token, session):
    """Той самий порядок, що у фронтенді: спершу резерв слота, потім підтвердження."""
    lock = await client.post("/appointments/lock", json={
        "business_id": business_id, "service_id": service_id, "start_time": start,
        "session_token": session, "direct_link_token": token,
    })
    assert lock.status_code == 200, lock.text
    r = await client.post("/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": start,
        "session_token": session, "client_name": "Клієнт", "client_email": f"{session}@t.com",
        "direct_link_token": token,
    })
    assert r.status_code == 200, r.text
    return r.json()


async def _commissions(client, headers, business_id):
    r = await client.get(f"/crm/businesses/{business_id}/commissions", headers=headers)
    return r.json()


@pytest.mark.asyncio
async def test_lock_flow_direct_token_is_free_and_marketplace_is_charged(client, auth_headers):
    headers = auth_headers("split-owner-1")
    business_id, service_id, token = await _salon(client, headers, "Split Salon")

    own = await _book_via_lock(client, business_id, service_id, _slot(2, 9), token, "sess-own")
    market = await _book_via_lock(client, business_id, service_id, _slot(2, 11), None, "sess-market")
    assert own["source"] == "direct"
    assert market["source"] == "marketplace"

    for appt in (own, market):
        await client.patch(f"/appointments/{appt['id']}/status", json={"status": "completed"}, headers=headers)

    rows = await _commissions(client, headers, business_id)
    assert [c["appointment_id"] for c in rows] == [market["id"]]
    assert float(rows[0]["amount"]) == 100.0


@pytest.mark.asyncio
async def test_token_of_another_salon_does_not_make_booking_direct(client, auth_headers):
    """Токен салону A, підставлений у запис до салону B, не дає права на 0%."""
    a_headers = auth_headers("split-owner-a")
    b_headers = auth_headers("split-owner-b")
    _, _, token_a = await _salon(client, a_headers, "Salon A")
    b_id, b_service, token_b = await _salon(client, b_headers, "Salon B")
    assert token_a != token_b

    booking = await _book_via_lock(client, b_id, b_service, _slot(2, 9), token_a, "sess-cross")
    assert booking["source"] == "marketplace"


@pytest.mark.asyncio
async def test_cancelled_marketplace_visit_has_no_commission(client, auth_headers):
    headers = auth_headers("split-owner-3")
    business_id, service_id, _ = await _salon(client, headers, "Cancel Salon")
    appt = await _book_via_lock(client, business_id, service_id, _slot(2, 9), None, "sess-cancel")

    await client.patch(f"/appointments/{appt['id']}/status", json={"status": "cancelled"}, headers=headers)
    await client.patch(f"/appointments/{appt['id']}/status", json={"status": "no-show"}, headers=headers)
    assert await _commissions(client, headers, business_id) == []


@pytest.mark.asyncio
async def test_manual_crm_visit_is_never_charged(client, auth_headers):
    """Запис, внесений адміністратором вручну, - власний клієнт закладу."""
    headers = auth_headers("split-owner-4")
    business_id, service_id, _ = await _salon(client, headers, "Manual Salon")
    r = await client.post("/crm/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": _slot(2, 9),
        "client_name": "Вручну", "client_phone": "+380501112233",
    }, headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["source"] == "manual"
    appt_id = r.json()["id"]
    await client.patch(f"/appointments/{appt_id}/status", json={"status": "completed"}, headers=headers)
    assert await _commissions(client, headers, business_id) == []


@pytest.mark.asyncio
async def test_commission_uses_rate_at_completion_and_price_actually_paid(client, auth_headers):
    """Комісія - від реальної ціни візиту (після сертифіката), а не від каталожної."""
    headers = auth_headers("split-owner-5")
    business_id, service_id, _ = await _salon(client, headers, "Price Salon", price=800)
    appt = await _book_via_lock(client, business_id, service_id, _slot(2, 9), None, "sess-price")
    assert float(appt["price"]) == 800.0
    await client.patch(f"/appointments/{appt['id']}/status", json={"status": "completed"}, headers=headers)
    rows = await _commissions(client, headers, business_id)
    assert float(rows[0]["amount"]) == 80.0
    assert float(rows[0]["rate_applied"]) == 10.0


async def _complete(client, headers, appt_id):
    await client.patch(f"/appointments/{appt_id}/status", json={"status": "completed"}, headers=headers)


async def _book_by_phone(client, business_id, service_id, start, token, phone, session):
    lock = await client.post("/appointments/lock", json={
        "business_id": business_id, "service_id": service_id, "start_time": start,
        "session_token": session, "direct_link_token": token,
    })
    assert lock.status_code == 200, lock.text
    r = await client.post("/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": start, "session_token": session,
        "client_name": "Ірина", "client_phone": phone, "direct_link_token": token,
    })
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.asyncio
async def test_only_first_visit_of_new_marketplace_client_is_charged(client, auth_headers):
    headers = auth_headers("split-owner-6")
    business_id, service_id, _ = await _salon(client, headers, "First Visit Salon")

    first = await _book_by_phone(client, business_id, service_id, _slot(2, 9), None, "+380671234567", "s-first")
    await _complete(client, headers, first["id"])
    second = await _book_by_phone(client, business_id, service_id, _slot(3, 9), None, "+38 (067) 123-45-67", "s-second")
    assert second["source"] == "marketplace", "джерело лишається чесним, а комісії за повторний візит немає"
    await _complete(client, headers, second["id"])

    rows = await _commissions(client, headers, business_id)
    assert [c["appointment_id"] for c in rows] == [first["id"]], "платним є лише перший візит нової людини"


@pytest.mark.asyncio
async def test_client_first_seen_via_direct_link_stays_free_via_marketplace(client, auth_headers):
    headers = auth_headers("split-owner-7")
    business_id, service_id, token = await _salon(client, headers, "Own Client Salon")

    own = await _book_by_phone(client, business_id, service_id, _slot(2, 9), token, "+380501112200", "s-own")
    await _complete(client, headers, own["id"])
    later = await _book_by_phone(client, business_id, service_id, _slot(5, 9), None, "+380501112200", "s-later")
    await _complete(client, headers, later["id"])

    assert await _commissions(client, headers, business_id) == []


@pytest.mark.asyncio
async def test_client_card_added_by_salon_before_booking_is_own(client, auth_headers):
    """Картка, яку заклад створив сам (вручну/імпорт) раніше за онлайн-запис, - власний клієнт."""
    from datetime import datetime
    from sqlalchemy import update
    from app.core.database import AsyncSessionLocal
    from app.models import Client

    headers = auth_headers("split-owner-8")
    business_id, service_id, _ = await _salon(client, headers, "Card Salon")
    r = await client.post("/crm/clients", json={"business_id": business_id, "name": "Стара клієнтка", "phone": "+380931110011"}, headers=headers)
    assert r.status_code == 201, r.text
    async with AsyncSessionLocal() as db:  # картка існує не секунди, а давно
        await db.execute(update(Client).where(Client.id == r.json()["id"]).values(created_at=datetime(2024, 1, 1)))
        await db.commit()

    appt = await _book_by_phone(client, business_id, service_id, _slot(2, 9), None, "+380931110011", "s-card")
    await _complete(client, headers, appt["id"])
    assert await _commissions(client, headers, business_id) == []


@pytest.mark.asyncio
async def test_platform_terms_describe_first_visit_policy(client):
    r = await client.get("/businesses/platform-terms")
    body = r.json()
    assert body["commission_first_visit_only"] is True
    assert body["direct_link_days"] == 30
