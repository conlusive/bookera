import asyncpg
import pytest
from datetime import datetime, timedelta, timezone

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _make_platform_admin(user_id: str):
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "INSERT INTO users (id, email, role, is_platform_admin, is_active, created_at) "
            "VALUES ($1, $2, 'business_owner', true, true, now()) "
            "ON CONFLICT (id) DO UPDATE SET is_platform_admin = true",
            user_id, f"{user_id}@test.com",
        )
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_platform_admin_check_answers_calmly(client, auth_headers):
    """
    «Чи я адміністратор» має мати спокійну відповідь «ні», а не 403:
    інтерфейс питає це на кожному завантаженні, щоб знати, чи показувати
    адмін-розділ.
    """
    r = await client.get("/platform/me", headers=auth_headers("just-a-user"))
    assert r.status_code == 200
    assert r.json()["is_platform_admin"] is False

    await _make_platform_admin("real-admin")
    r = await client.get("/platform/me", headers=auth_headers("real-admin"))
    assert r.json()["is_platform_admin"] is True


@pytest.mark.asyncio
async def test_only_platform_admin_can_grant_subscription(client, auth_headers):
    owner = auth_headers("sub-owner")
    r = await client.post("/crm/businesses", json={"name": "Sub Salon", "city": "Львів"}, headers=owner)
    business_id = r.json()["id"]

    # Власник закладу - НЕ адміністратор платформи: він не може
    # видати підписку сам собі
    r = await client.post(f"/platform/businesses/{business_id}/subscription",
                          json={"plan": "active"}, headers=owner)
    assert r.status_code == 403

    await _make_platform_admin("granting-admin")
    r = await client.post(f"/platform/businesses/{business_id}/subscription",
                          json={"plan": "active", "days": 30, "note": "Партнер"},
                          headers=auth_headers("granting-admin"))
    assert r.status_code == 200, r.text
    assert r.json()["subscription_plan"] == "active"
    assert r.json()["is_subscription_active"] is True
    assert r.json()["subscription_note"] == "Партнер"


@pytest.mark.asyncio
async def test_subscription_without_date_is_perpetual(client, auth_headers):
    """
    Без вказаної кількості днів підписка безстрокова - так адміністратор
    видає доступ партнеру, не вигадуючи дату «до 2099 року».
    """
    owner = auth_headers("perp-owner")
    r = await client.post("/crm/businesses", json={"name": "Perp Salon", "city": "Львів"}, headers=owner)
    business_id = r.json()["id"]

    await _make_platform_admin("perp-admin")
    r = await client.post(f"/platform/businesses/{business_id}/subscription",
                          json={"plan": "active"}, headers=auth_headers("perp-admin"))
    assert r.json()["subscription_until"] is None
    assert r.json()["is_subscription_active"] is True


@pytest.mark.asyncio
async def test_expired_subscription_is_not_active(client, auth_headers):
    """План 'pro' із простроченою датою - не платний клієнт."""
    owner = auth_headers("exp-owner")
    r = await client.post("/crm/businesses", json={"name": "Expired Salon", "city": "Львів"}, headers=owner)
    business_id = r.json()["id"]

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "UPDATE businesses SET subscription_plan='active', subscription_until=$1 WHERE id=$2",
            datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1), business_id,
        )
    finally:
        await conn.close()

    await _make_platform_admin("exp-admin")
    r = await client.get("/platform/businesses?plan=active", headers=auth_headers("exp-admin"))
    found = [b for b in r.json() if b["id"] == business_id]
    assert found and found[0]["is_subscription_active"] is False


@pytest.mark.asyncio
async def test_campaign_requires_subscription(client, auth_headers):
    """
    Розсилка - платна можливість. Раніше кнопка «Відправити» показувала
    «Розсилку відправлено», а жоден лист нікуди не йшов.
    """
    owner = auth_headers("camp-owner")
    r = await client.post("/crm/businesses", json={"name": "Campaign Salon", "city": "Львів"}, headers=owner)
    business_id = r.json()["id"]

    await client.post("/crm/clients", json={
        "business_id": business_id, "name": "Клієнт", "email": "client@test.com", "phone": "+380671110000",
    }, headers=owner)

    # Новий заклад у пробному періоді - розсилка працює одразу
    r = await client.post("/crm/campaigns", json={
        "business_id": business_id, "subject": "Знижка", "message": "Тестове повідомлення для розсилки",
    }, headers=owner)
    assert r.status_code == 200, r.text
    assert r.json()["queued"] == 1

    # Прострочена підписка закриває доступ
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "UPDATE businesses SET subscription_plan='expired', subscription_until=NULL WHERE id=$1",
            business_id,
        )
    finally:
        await conn.close()

    r = await client.post("/crm/campaigns", json={
        "business_id": business_id, "subject": "Знижка", "message": "Тестове повідомлення для розсилки",
    }, headers=owner)
    assert r.status_code == 402
    assert "підписки" in r.json()["detail"]


@pytest.mark.asyncio
async def test_campaign_audience_filters(client, auth_headers):
    """Аудиторія має звужуватись: «постійним» не те саме, що «всім»."""
    owner = auth_headers("aud-owner")
    r = await client.post("/crm/businesses", json={"name": "Audience Salon", "city": "Львів"}, headers=owner)
    business_id = r.json()["id"]

    await _make_platform_admin("aud-admin")
    await client.post(f"/platform/businesses/{business_id}/subscription",
                      json={"plan": "active"}, headers=auth_headers("aud-admin"))

    for i, visits in enumerate([1, 5]):
        r = await client.post("/crm/clients", json={
            "business_id": business_id, "name": f"К{i}",
            "email": f"c{i}@test.com", "phone": f"+38067111000{i}",
        }, headers=owner)
        conn = await asyncpg.connect(DB_URL_RAW)
        try:
            await conn.execute("UPDATE clients SET visits_count=$1 WHERE id=$2", visits, r.json()["id"])
        finally:
            await conn.close()

    r = await client.post("/crm/campaigns", json={
        "business_id": business_id, "subject": "Всім", "message": "Повідомлення для всіх клієнтів",
        "audience": "all",
    }, headers=owner)
    assert r.json()["queued"] == 2

    r = await client.post("/crm/campaigns", json={
        "business_id": business_id, "subject": "Постійним", "message": "Повідомлення для постійних клієнтів",
        "audience": "regular",
    }, headers=owner)
    assert r.json()["queued"] == 1, "лише клієнт із 3+ візитами"


async def _expire(business_id: int):
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "UPDATE businesses SET subscription_plan='expired', subscription_until=NULL WHERE id=$1",
            business_id,
        )
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_expired_business_stops_accepting_bookings(client, auth_headers):
    """
    Найгірший сценарій, який це закриває: клієнт записується, отримує
    лист, приходить - а заклад запису НЕ БАЧИВ, бо кабінет закритий.
    Краще чесно не прийняти запис, ніж прийняти й загубити.
    """
    headers = auth_headers("expired-book-owner")
    r = await client.post("/crm/businesses", json={"name": "Expired Book", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={
        "business_id": business_id, "name": "Стрижка", "duration_minutes": 60, "price": 400,
    }, headers=headers)
    service_id = r.json()["id"]

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)
    payload = {
        "business_id": business_id, "service_id": service_id,
        "start_time": start.isoformat(), "client_name": "К", "client_phone": "+380671234567",
    }

    # У пробному періоді - запис проходить
    r = await client.post("/appointments", json=payload)
    assert r.status_code == 200, r.text

    await _expire(business_id)

    payload["start_time"] = (start + timedelta(hours=3)).isoformat()
    r = await client.post("/appointments", json=payload)
    assert r.status_code == 403
    # Клієнту НЕ повідомляємо, що в закладу проблеми з оплатою сервісу
    assert "підписк" not in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_expired_business_hidden_from_catalog(client, auth_headers):
    """Заклад без доступу не показуємо: він однаково не прийме запис."""
    headers = auth_headers("catalog-owner")
    r = await client.post("/crm/businesses", json={"name": "Catalog Test Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.get("/businesses/?limit=200")
    assert any(b["id"] == business_id for b in r.json()), "у пробному періоді має бути видно"

    await _expire(business_id)
    r = await client.get("/businesses/?limit=200")
    assert not any(b["id"] == business_id for b in r.json())


@pytest.mark.asyncio
async def test_owner_can_pay_even_when_expired(client, auth_headers):
    """
    Класичний глухий кут, якого тут немає: якби оплата вимагала чинної
    підписки, заклад із простроченим доступом не міг би її продовжити.
    """
    headers = auth_headers("pay-owner")
    r = await client.post("/crm/businesses", json={"name": "Pay Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    await _expire(business_id)

    r = await client.post(f"/platform/subscription/checkout?business_id={business_id}", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["order_id"].startswith(f"sub-{business_id}-")
    assert r.json()["amount"] > 0

    # Чужа людина оплатити не може
    r = await client.post(f"/platform/subscription/checkout?business_id={business_id}",
                          headers=auth_headers("random-person"))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_payment_callback_extends_subscription(client, auth_headers):
    headers = auth_headers("callback-owner")
    r = await client.post("/crm/businesses", json={"name": "Callback Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    await _expire(business_id)

    r = await client.post(f"/platform/subscription/checkout?business_id={business_id}", headers=headers)
    order_id = r.json()["order_id"]

    r = await client.post("/platform/subscription/callback", json={
        "orderReference": order_id, "transactionStatus": "Approved",
    })
    assert r.status_code == 200, r.text

    # Доступ повернувся
    r = await client.get("/crm/businesses/me", headers=headers)
    assert r.json()["subscription"]["has_access"] is True
    assert r.json()["subscription"]["status"] == "active"

    # Повторний виклик не продовжує вдруге: платіжні системи надсилають
    # підтвердження кілька разів
    r = await client.post("/platform/subscription/callback", json={
        "orderReference": order_id, "transactionStatus": "Approved",
    })
    assert r.json()["status"] == "already_processed"
