import pytest

from app.services.business_limits import DEFAULT_MAX_OWNED_BUSINESSES


@pytest.mark.asyncio
async def test_owner_cannot_create_more_than_limit(client, auth_headers, monkeypatch):
    monkeypatch.delenv("MAX_BUSINESSES_PER_OWNER", raising=False)
    h = auth_headers("limit-owner")
    for i in range(DEFAULT_MAX_OWNED_BUSINESSES):
        r = await client.post("/crm/businesses", json={"name": f"Заклад {i}", "city": "Львів"}, headers=h)
        assert r.status_code == 201, r.text

    r = await client.post("/crm/businesses", json={"name": "Зайвий", "city": "Львів"}, headers=h)
    assert r.status_code == 403
    assert "ліміт" in r.json()["detail"].lower()

    # Ліміт - на людину: інший власник створює без проблем
    other = auth_headers("limit-other")
    r = await client.post("/crm/businesses", json={"name": "Чужий", "city": "Львів"}, headers=other)
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_limit_is_configurable(client, auth_headers, monkeypatch):
    monkeypatch.setenv("MAX_BUSINESSES_PER_OWNER", "1")
    h = auth_headers("limit-one")
    assert (await client.post("/crm/businesses", json={"name": "Єдиний", "city": "Львів"}, headers=h)).status_code == 201
    assert (await client.post("/crm/businesses", json={"name": "Другий", "city": "Львів"}, headers=h)).status_code == 403
