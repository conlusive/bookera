import asyncpg
import pytest
from datetime import datetime, timedelta, timezone

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _set_rules(business_id: int, booking=None, security=None):
    import json
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        if booking is not None:
            await conn.execute(
                "UPDATE businesses SET booking_settings = $1::json WHERE id = $2",
                json.dumps(booking), business_id,
            )
        if security is not None:
            await conn.execute(
                "UPDATE businesses SET security_settings = $1::json WHERE id = $2",
                json.dumps(security), business_id,
            )
    finally:
        await conn.close()


async def _setup(client, headers, name="Rules Salon"):
    r = await client.post("/crm/businesses", json={"name": name, "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={
        "business_id": business_id, "name": "Стрижка", "duration_minutes": 60, "price": 500,
    }, headers=headers)
    return business_id, r.json()["id"]


def _book_payload(business_id, service_id, start, phone="+380671112233"):
    return {
        "business_id": business_id,
        "service_id": service_id,
        "start_time": start.isoformat(),
        "client_name": "Клієнт",
        "client_phone": phone,
    }


@pytest.mark.asyncio
async def test_booking_disabled_blocks_new_appointments(client, auth_headers):
    """«Онлайн-запис вимкнено» раніше було декорацією: налаштування
    зберігалось, але бронювання все одно проходило."""
    headers = auth_headers("rules-owner-1")
    business_id, service_id = await _setup(client, headers, "Disabled Salon")
    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)

    # Поки увімкнено - запис проходить
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, start))
    assert r.status_code == 200, r.text

    await _set_rules(business_id, booking={"is_active": False})
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, start + timedelta(hours=3)))
    assert r.status_code == 403
    assert "вимкнено" in r.json()["detail"]


@pytest.mark.asyncio
async def test_emergency_pause_blocks_bookings(client, auth_headers):
    headers = auth_headers("rules-owner-2")
    business_id, service_id = await _setup(client, headers, "Paused Salon")
    await _set_rules(business_id, booking={"is_active": True, "is_paused_emergency": True})

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, start))
    assert r.status_code == 403
    assert "тимчасово" in r.json()["detail"]


@pytest.mark.asyncio
async def test_min_advance_hours_enforced(client, auth_headers):
    """«Не раніше ніж за N годин» - захист від записів на через 10 хвилин."""
    headers = auth_headers("rules-owner-3")
    business_id, service_id = await _setup(client, headers, "MinAdvance Salon")
    await _set_rules(business_id, booking={"is_active": True, "min_advance_hours": 4})

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    r = await client.post("/appointments", json=_book_payload(business_id, service_id, now + timedelta(hours=1)))
    assert r.status_code == 400
    assert "щонайменше" in r.json()["detail"]

    r = await client.post("/appointments", json=_book_payload(business_id, service_id, now + timedelta(hours=6)))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_max_advance_days_enforced(client, auth_headers):
    headers = auth_headers("rules-owner-4")
    business_id, service_id = await _setup(client, headers, "MaxAdvance Salon")
    await _set_rules(business_id, booking={"is_active": True, "max_advance_days": 14})

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    r = await client.post("/appointments", json=_book_payload(business_id, service_id, now + timedelta(days=30)))
    assert r.status_code == 400
    assert "наперед" in r.json()["detail"]

    r = await client.post("/appointments", json=_book_payload(business_id, service_id, now + timedelta(days=5)))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_blacklisted_client_cannot_book(client, auth_headers):
    """
    Позначка «у чорному списку» раніше нічого не давала: клієнт спокійно
    записувався далі. Формулювання відмови нейтральне - повідомляти
    людині, що вона в чорному списку, це розмова для закладу.
    """
    headers = auth_headers("rules-owner-5")
    business_id, service_id = await _setup(client, headers, "Blacklist Salon")

    r = await client.post("/crm/clients", json={
        "business_id": business_id, "name": "Проблемний", "phone": "+380671112233",
    }, headers=headers)
    client_id = r.json()["id"]
    await client.patch(f"/crm/clients/{client_id}", json={"is_blacklisted": True}, headers=headers)

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, start))
    assert r.status_code == 403
    assert "чорн" not in r.json()["detail"].lower(), "не повідомляємо причину клієнту"

    # Інший номер - без обмежень
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, start, phone="+380509998877"))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_registration_data_shapes_booking_rules(client, auth_headers):
    """
    Дані з реєстрації мають впливати на поведінку, а не просто лежати
    в базі: барбер і майстер манікюру отримують різні правила.
    """
    # Барбер: короткі візити, можна записатись майже одразу
    r = await client.post("/crm/businesses", json={
        "name": "Barber Profile", "city": "Львів",
        "category": "barber", "business_type": "company", "workspace_type": "my_place",
    }, headers=auth_headers("profile-barber"))
    assert r.status_code == 201, r.text
    barber = r.json()["booking_settings"]
    assert barber["min_advance_hours"] == 1

    # Манікюр: довші візити, більше часу на підготовку
    r = await client.post("/crm/businesses", json={
        "name": "Nails Profile", "city": "Львів",
        "category": "nails", "business_type": "individual", "workspace_type": "my_place",
    }, headers=auth_headers("profile-nails"))
    nails = r.json()["booking_settings"]
    assert nails["min_advance_hours"] == 3
    # Приватний майстер планує далі наперед
    assert nails["max_advance_days"] == 90

    # Виїзд до клієнта: майстру потрібен час на дорогу, тому запис
    # «через годину» нереалістичний навіть для барбера
    r = await client.post("/crm/businesses", json={
        "name": "Mobile Barber", "city": "Львів",
        "category": "barber", "business_type": "individual", "workspace_type": "client_place",
    }, headers=auth_headers("profile-mobile"))
    mobile = r.json()["booking_settings"]
    assert mobile["min_advance_hours"] >= 4, "виїзд потребує запасу часу"
    assert "адресою" in mobile["cancellation_policy"]


@pytest.mark.asyncio
async def test_profile_rules_actually_block_booking(client, auth_headers):
    """Правила з профілю - не декорація: вони справді відмовляють."""
    headers = auth_headers("profile-enforce")
    r = await client.post("/crm/businesses", json={
        "name": "Enforce Salon", "city": "Львів",
        "category": "nails", "business_type": "company", "workspace_type": "my_place",
    }, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={
        "business_id": business_id, "name": "Манікюр", "duration_minutes": 90, "price": 700,
    }, headers=headers)
    service_id = r.json()["id"]

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Манікюр - мінімум 3 години наперед
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, now + timedelta(hours=1)))
    assert r.status_code == 400

    r = await client.post("/appointments", json=_book_payload(business_id, service_id, now + timedelta(hours=5)))
    assert r.status_code == 200, r.text
