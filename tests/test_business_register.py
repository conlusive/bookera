import pytest


@pytest.mark.asyncio
async def test_register_keeps_city_and_salon_contacts(client, auth_headers):
    """
    Раніше місто не надсилалось окремо, і сервер ставив «Львів» усім.
    Пошта й телефон - закладу; телефон нормалізується до +380.
    """
    h = auth_headers("reg-owner-1")
    r = await client.post("/crm/businesses", json={
        "name": "Київська студія", "category": "nails", "city": "Київ", "address": "вул. Хрещатик, 1",
        "email": "  Studio@Example.COM ", "phone": "067 123 45 67", "latitude": 50.4501, "longitude": 30.5234,
    }, headers=h)
    assert r.status_code in (200, 201), r.text
    b = r.json()
    assert b["city"] == "Київ" and b["email"] == "studio@example.com" and b["phone"] == "+380671234567"
    assert abs(float(b["latitude"]) - 50.4501) < 1e-4, "точка з мапи - без геокодування"


@pytest.mark.asyncio
async def test_register_rejects_bad_contacts(client, auth_headers):
    h = auth_headers("reg-owner-2")
    bad_email = await client.post("/crm/businesses", json={"name": "X", "city": "Київ", "email": "не-пошта"}, headers=h)
    assert bad_email.status_code == 422
    bad_phone = await client.post("/crm/businesses", json={"name": "X", "city": "Київ", "email": "a@b.ua", "phone": "12345"}, headers=h)
    assert bad_phone.status_code == 422


@pytest.mark.asyncio
async def test_business_email_is_not_owner_email(client, auth_headers):
    """Жодних даних користувача: пошта закладу - лише та, що вказали для закладу."""
    h = auth_headers("reg-owner-3")
    b = (await client.post("/crm/businesses", json={"name": "Без пошти", "city": "Одеса"}, headers=h)).json()
    assert b["email"] in (None, ""), "пошта власника не підставляється"
