import pytest


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/crm/clients?business_id=1"),
        ("POST", "/crm/clients"),
        ("GET", "/crm/businesses/1/staff"),
        ("GET", "/crm/inventory?business_id=1"),
        ("GET", "/crm/expenses?business_id=1"),
        ("POST", "/crm/businesses/1/invites"),
    ],
)
@pytest.mark.asyncio
async def test_crm_endpoints_require_auth(client, method, path):
    r = await client.request(method, path, json={} if method == "POST" else None)
    assert r.status_code == 401, f"{method} {path} мав повернути 401 без токена, отримав {r.status_code}"


@pytest.mark.parametrize(
    "path",
    [
        "/businesses/",
        "/businesses/search-available?target_date=2026-09-15",
    ],
)
@pytest.mark.asyncio
async def test_public_endpoints_work_without_auth(client, path):
    r = await client.get(path)
    assert r.status_code == 200, f"{path} мав бути публічним, отримав {r.status_code}: {r.text}"


@pytest.mark.asyncio
async def test_user_cannot_access_another_business_data(client, auth_headers):
    owner_headers = auth_headers("owner-isolated")
    r = await client.post("/crm/businesses", json={"name": "Приватний салон", "city": "Львів"}, headers=owner_headers)
    business_id = r.json()["id"]

    r = await client.post(
        "/crm/clients", json={"business_id": business_id, "name": "Секретний клієнт"}, headers=owner_headers
    )
    assert r.status_code == 201

    intruder_headers = auth_headers("random-intruder")
    r = await client.get(f"/crm/clients?business_id={business_id}", headers=intruder_headers)
    assert r.status_code == 403, "Чужий юзер не повинен бачити клієнтів іншого бізнесу"


@pytest.mark.asyncio
async def test_client_pii_not_exposed_without_auth(client, auth_headers):
    """
    Регресійний тест на витік PII: раніше /appointments/booked віддавав
    імена/телефони/email клієнтів без жодної перевірки токена.
    """
    r = await client.get("/appointments/booked?business_id=1")
    assert r.status_code == 401
