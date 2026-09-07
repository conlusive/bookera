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
                          json={"plan": "pro"}, headers=owner)
    assert r.status_code == 403

    await _make_platform_admin("granting-admin")
    r = await client.post(f"/platform/businesses/{business_id}/subscription",
                          json={"plan": "pro", "days": 30, "note": "Партнер"},
                          headers=auth_headers("granting-admin"))
    assert r.status_code == 200, r.text
    assert r.json()["subscription_plan"] == "pro"
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
                          json={"plan": "pro"}, headers=auth_headers("perp-admin"))
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
            "UPDATE businesses SET subscription_plan='pro', subscription_until=$1 WHERE id=$2",
            datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1), business_id,
        )
    finally:
        await conn.close()

    await _make_platform_admin("exp-admin")
    r = await client.get("/platform/businesses?plan=pro", headers=auth_headers("exp-admin"))
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

    # Без підписки - відмова з поясненням, ЩО саме недоступне
    r = await client.post("/crm/campaigns", json={
        "business_id": business_id, "subject": "Знижка", "message": "Тестове повідомлення для розсилки",
    }, headers=owner)
    assert r.status_code == 402
    assert "Маркетинг" in r.json()["detail"]

    # З підпискою - працює
    await _make_platform_admin("camp-admin")
    await client.post(f"/platform/businesses/{business_id}/subscription",
                      json={"plan": "pro"}, headers=auth_headers("camp-admin"))

    r = await client.post("/crm/campaigns", json={
        "business_id": business_id, "subject": "Знижка", "message": "Тестове повідомлення для розсилки",
    }, headers=owner)
    assert r.status_code == 200, r.text
    assert r.json()["queued"] == 1


@pytest.mark.asyncio
async def test_campaign_audience_filters(client, auth_headers):
    """Аудиторія має звужуватись: «постійним» не те саме, що «всім»."""
    owner = auth_headers("aud-owner")
    r = await client.post("/crm/businesses", json={"name": "Audience Salon", "city": "Львів"}, headers=owner)
    business_id = r.json()["id"]

    await _make_platform_admin("aud-admin")
    await client.post(f"/platform/businesses/{business_id}/subscription",
                      json={"plan": "pro"}, headers=auth_headers("aud-admin"))

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
