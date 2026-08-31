import asyncpg
import pytest
from datetime import datetime, timedelta, timezone

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _get_manage_token(db_url_raw: str, appointment_id: int) -> str:
    conn = await asyncpg.connect(db_url_raw)
    try:
        return await conn.fetchval("SELECT manage_token FROM appointments WHERE id=$1", appointment_id)
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_client_can_view_and_cancel_own_booking_via_token(client, auth_headers):
    headers = auth_headers("self-service-owner")
    r = await client.post("/crm/businesses", json={"name": "Self Service Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={"business_id": business_id, "name": "Стрижка", "duration_minutes": 30, "price": 400}, headers=headers)
    service_id = r.json()["id"]

    slot = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)).replace(hour=15, minute=0)
    r = await client.post("/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": slot.isoformat(),
        "client_name": "Тест", "client_email": "test@test.com",
    })
    assert r.status_code == 200
    appt_id = r.json()["id"]
    assert "manage_token" not in r.json(), "Токен не повинен потрапляти у відповідь API"

    r = await client.get(f"/appointments/{appt_id}/manage", params={"token": "неправильний"})
    assert r.status_code == 404

    real_token = await _get_manage_token(DB_URL_RAW, appt_id)
    r = await client.get(f"/appointments/{appt_id}/manage", params={"token": real_token})
    assert r.status_code == 200

    r = await client.post(f"/appointments/{appt_id}/cancel", json={"token": real_token})
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"

    r = await client.post(f"/appointments/{appt_id}/cancel", json={"token": real_token})
    assert r.status_code == 409, "Повторне скасування вже скасованого запису має бути заборонене"


@pytest.mark.asyncio
async def test_manual_staff_booking_requires_auth_and_creates_client(client, auth_headers):
    headers = auth_headers("manual-booking-owner")
    r = await client.post("/crm/businesses", json={"name": "Manual Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={"business_id": business_id, "name": "Манікюр", "duration_minutes": 60, "price": 500}, headers=headers)
    service_id = r.json()["id"]

    slot = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=3)).replace(hour=11, minute=0)

    r = await client.post("/crm/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": slot.isoformat(),
    })
    assert r.status_code == 401, "Ручне створення без токена має бути заборонене"

    r = await client.post("/crm/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": slot.isoformat(),
        "client_name": "Дзвінок", "client_phone": "+380671112233",
    }, headers=headers)
    assert r.status_code == 201
    assert r.json()["source"] == "manual"

    r = await client.get(f"/crm/clients?business_id={business_id}", headers=headers)
    phones = [c["phone"] for c in r.json()]
    assert "+380671112233" in phones, "Ручний запис має автоматично створити CRM-контакт"


@pytest.mark.asyncio
async def test_business_stats_endpoint(client, auth_headers):
    headers = auth_headers("stats-owner")
    r = await client.post("/crm/businesses", json={"name": "Stats Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.get(f"/crm/businesses/{business_id}/stats", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "revenue_completed" in data
    assert "top_services" in data
    assert isinstance(data["top_services"], list)

    intruder = auth_headers("stats-intruder")
    r = await client.get(f"/crm/businesses/{business_id}/stats", headers=intruder)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_manual_time_block_and_reschedule(client, auth_headers):
    """Блокування часу (обід тощо) - без клієнта/послуги, і перенесення на інший час."""
    headers = auth_headers("block-test-owner")
    r = await client.post("/crm/businesses", json={"name": "Block Test Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    from datetime import datetime, timedelta, timezone
    slot = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)).replace(hour=13, minute=0)

    r = await client.post("/crm/appointments", json={
        "business_id": business_id, "start_time": slot.isoformat(), "is_block": True, "duration_minutes": 60,
    }, headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["service_id"] is None
    assert r.json()["client_name"] == "Неробочий час"
    block_id = r.json()["id"]

    # Без duration_minutes блокування створити не можна
    r = await client.post("/crm/appointments", json={
        "business_id": business_id, "start_time": slot.isoformat(), "is_block": True,
    }, headers=headers)
    assert r.status_code == 400

    # Перенесення на інший час - тривалість (60 хв) зберігається
    new_start = slot + timedelta(hours=3)
    r = await client.patch(f"/crm/appointments/{block_id}/reschedule", json={"start_time": new_start.isoformat()}, headers=headers)
    assert r.status_code == 200
    new_end = datetime.fromisoformat(r.json()["end_time"])
    new_start_resp = datetime.fromisoformat(r.json()["start_time"])
    assert (new_end - new_start_resp).total_seconds() == 3600

    # Перенесення без авторизації - заборонено
    r = await client.patch(f"/crm/appointments/{block_id}/reschedule", json={"start_time": slot.isoformat()})
    assert r.status_code == 401
