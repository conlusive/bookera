import asyncpg
import json
import pytest
from datetime import datetime, timedelta, timezone

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


def _json_list(value):
    """asyncpg віддає JSON-колонку рядком: 'null' або '[1, 2]'."""
    if value is None:
        return None
    if isinstance(value, str):
        return json.loads(value)
    return value


async def _setup_with_addons(client, headers, name="Addon Salon"):
    """Заклад з основною послугою та двома додатковими."""
    r = await client.post("/crm/businesses", json={"name": name, "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.post("/services", json={
        "business_id": business_id, "name": "Борода", "duration_minutes": 15, "price": 150,
    }, headers=headers)
    addon_1 = r.json()["id"]

    r = await client.post("/services", json={
        "business_id": business_id, "name": "Миття голови", "duration_minutes": 10, "price": 100,
    }, headers=headers)
    addon_2 = r.json()["id"]

    r = await client.post("/services", json={
        "business_id": business_id, "name": "Стрижка", "duration_minutes": 45, "price": 500,
        "addon_service_ids": [addon_1, addon_2],
    }, headers=headers)
    main_service = r.json()["id"]

    return business_id, main_service, addon_1, addon_2


def _payload(business_id, service_id, start, addons=None):
    data = {
        "business_id": business_id,
        "service_id": service_id,
        "start_time": start.isoformat(),
        "client_name": "Клієнт",
        "client_phone": "+380671112233",
    }
    if addons is not None:
        data["addon_service_ids"] = addons
    return data


@pytest.mark.asyncio
async def test_addons_extend_duration_and_price(client, auth_headers):
    """
    Головне, що це закриває: клієнт обирав послуг на 750 ₴, а заклад
    бачив у календарі 500 ₴ і 45 хвилин замість 70 - майстер не знав,
    що робити, і не встигав.
    """
    headers = auth_headers("addon-owner-1")
    business_id, main_service, addon_1, addon_2 = await _setup_with_addons(client, headers)

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)
    r = await client.post("/appointments", json=_payload(business_id, main_service, start, [addon_1, addon_2]))
    assert r.status_code == 200, r.text

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        row = await conn.fetchrow(
            "SELECT start_time, end_time, price, addon_service_ids FROM appointments WHERE id=$1",
            r.json()["id"],
        )
    finally:
        await conn.close()

    minutes = int((row["end_time"] - row["start_time"]).total_seconds() // 60)
    assert minutes == 45 + 15 + 10, f"тривалість має включати додаткові: {minutes}"
    assert float(row["price"]) == 500 + 150 + 100, "ціна має включати додаткові"
    # asyncpg віддає JSON-колонку рядком, а не списком
    assert sorted(_json_list(row["addon_service_ids"])) == sorted([addon_1, addon_2])


@pytest.mark.asyncio
async def test_booking_without_addons_unchanged(client, auth_headers):
    """Без додаткових усе лишається як було - базова поведінка не змінилась."""
    headers = auth_headers("addon-owner-2")
    business_id, main_service, _, _ = await _setup_with_addons(client, headers, "No Addon Salon")

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)
    r = await client.post("/appointments", json=_payload(business_id, main_service, start))
    assert r.status_code == 200, r.text

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        row = await conn.fetchrow(
            "SELECT start_time, end_time, price, addon_service_ids FROM appointments WHERE id=$1",
            r.json()["id"],
        )
    finally:
        await conn.close()

    assert int((row["end_time"] - row["start_time"]).total_seconds() // 60) == 45
    assert float(row["price"]) == 500
    assert _json_list(row["addon_service_ids"]) is None


@pytest.mark.asyncio
async def test_foreign_addon_is_rejected(client, auth_headers):
    """
    Захист від підробки: клієнт міг би передати будь-який id і додати
    до візиту те, чого заклад не пропонував, - або чужу послугу
    з іншого закладу. Приймаємо лише ті, що прикріплені до цієї послуги.
    """
    headers_a = auth_headers("addon-owner-3")
    headers_b = auth_headers("addon-owner-4")

    business_a, main_a, _, _ = await _setup_with_addons(client, headers_a, "Addon Salon A")
    business_b, main_b, addon_b, _ = await _setup_with_addons(client, headers_b, "Addon Salon B")

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)
    # Намагаємось причепити послугу ІНШОГО закладу
    r = await client.post("/appointments", json=_payload(business_a, main_a, start, [addon_b]))
    assert r.status_code == 200, r.text

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        row = await conn.fetchrow(
            "SELECT start_time, end_time, price, addon_service_ids FROM appointments WHERE id=$1",
            r.json()["id"],
        )
    finally:
        await conn.close()

    assert _json_list(row["addon_service_ids"]) is None, "чужа послуга не має потрапити в запис"
    assert float(row["price"]) == 500, "і не має вплинути на ціну"
    assert int((row["end_time"] - row["start_time"]).total_seconds() // 60) == 45


@pytest.mark.asyncio
async def test_certificate_applies_to_full_sum_with_addons(client, auth_headers):
    """
    Сертифікат рахується від ПОВНОЇ суми разом із додатковими.
    Якби він застосовувався до базової ціни, клієнт втрачав би
    частину номіналу - знижка рахувалась би від меншого числа.
    """
    headers = auth_headers("addon-cert-owner")
    business_id, main_service, addon_1, _ = await _setup_with_addons(client, headers, "Cert Addon Salon")

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "INSERT INTO gift_certificates (business_id, code, initial_amount, remaining_amount, status, created_at) "
            "VALUES ($1, 'ADDON100', 300, 300, 'active', now())",
            business_id,
        )
    finally:
        await conn.close()

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)
    payload = _payload(business_id, main_service, start, [addon_1])
    payload["gift_certificate_code"] = "ADDON100"

    r = await client.post("/appointments", json=payload)
    assert r.status_code == 200, r.text

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        price = await conn.fetchval("SELECT price FROM appointments WHERE id=$1", r.json()["id"])
    finally:
        await conn.close()

    # 500 + 150 = 650, мінус сертифікат 300 = 350
    assert float(price) == 350, f"очікували 350, отримали {price}"
