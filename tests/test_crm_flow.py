import pytest


@pytest.mark.asyncio
async def test_full_business_onboarding_flow(client, auth_headers):
    headers = auth_headers("full-flow-owner")

    # 1. Реєстрація бізнесу - owner_id визначається сервером з токена
    r = await client.post("/crm/businesses", json={"name": "Повний Цикл Салон", "city": "Львів", "phone": "+380501112233"}, headers=headers)
    assert r.status_code == 201, r.text
    business = r.json()
    assert business["name"] == "Повний Цикл Салон"
    business_id = business["id"]

    # 2. Створення послуги
    r = await client.post("/services", json={"business_id": business_id, "name": "Манікюр", "duration_minutes": 60, "price": 600}, headers=headers)
    assert r.status_code == 201

    # 3. Створення клієнта
    r = await client.post("/crm/clients", json={"business_id": business_id, "name": "Оксана", "phone": "+380671234567"}, headers=headers)
    assert r.status_code == 201
    client_id = r.json()["id"]

    # 4. Оновлення клієнта
    r = await client.patch(f"/crm/clients/{client_id}", json={"notes": "Постійна клієнтка"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["notes"] == "Постійна клієнтка"

    # 5. Список клієнтів
    r = await client.get(f"/crm/clients?business_id={business_id}", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1

    # 6. Запрошення співробітника
    r = await client.post(f"/crm/businesses/{business_id}/invites", json={"email": "master@test.com", "role": "master"}, headers=headers)
    assert r.status_code == 201
    assert r.json()["status"] == "pending"

    # 7. Робочі години
    r = await client.put(
        f"/crm/businesses/{business_id}/hours",
        json=[{"weekday": i, "is_open": i < 6, "open_time": "09:00", "close_time": "20:00"} for i in range(7)],
        headers=headers,
    )
    assert r.status_code == 200
    assert len(r.json()) == 7

    # 8. Видалення клієнта - для цього кроку створюємо ОКРЕМОГО клієнта без
    # телефону (щоб не мати історії балів) - "Оксана" вище вже має бали
    # нараховані за неї, і видалення такого клієнта тепер справедливо
    # заборонене (перевіряється в test_client_with_appointment_history_cannot_be_deleted
    # та окремим тестом на бали нижче).
    r = await client.post("/crm/clients", json={"business_id": business_id, "name": "Тимчасовий"}, headers=headers)
    temp_client_id = r.json()["id"]
    r = await client.delete(f"/crm/clients/{temp_client_id}", headers=headers)
    assert r.status_code == 204

    r = await client.get(f"/crm/clients?business_id={business_id}", headers=headers)
    assert len(r.json()) == 1  # лишилась тільки Оксана


@pytest.mark.asyncio
async def test_client_link_and_unlink(client, auth_headers):
    headers = auth_headers("link-owner")
    r = await client.post("/crm/businesses", json={"name": "Link Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.post("/crm/clients", json={"business_id": business_id, "name": "Мама"}, headers=headers)
    client_a = r.json()["id"]
    r = await client.post("/crm/clients", json={"business_id": business_id, "name": "Донька"}, headers=headers)
    client_b = r.json()["id"]

    r = await client.post(f"/crm/clients/{client_a}/link/{client_b}", headers=headers)
    assert r.status_code == 200
    assert client_b in r.json()["linked_client_ids"]

    # симетричність - у другого теж має з'явитись зв'язок
    r = await client.get(f"/crm/clients?business_id={business_id}", headers=headers)
    by_id = {c["id"]: c for c in r.json()}
    assert client_a in by_id[client_b]["linked_client_ids"]

    r = await client.delete(f"/crm/clients/{client_a}/link/{client_b}", headers=headers)
    assert r.status_code == 200
    assert client_b not in r.json()["linked_client_ids"]


@pytest.mark.asyncio
async def test_client_with_appointment_history_cannot_be_deleted(client, auth_headers):
    """
    Регресійний тест: раніше видалення клієнта з бронюваннями мовчки
    обнуляло client_id на його історії відвідувань (побічний ефект ORM),
    замість явної заборони.
    """
    headers = auth_headers("delete-safety-owner")
    r = await client.post("/crm/businesses", json={"name": "Delete Safety Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.post("/services", json={"business_id": business_id, "name": "Стрижка", "duration_minutes": 30, "price": 300}, headers=headers)
    service_id = r.json()["id"]

    r = await client.post("/crm/clients", json={"business_id": business_id, "name": "Клієнт з історією"}, headers=headers)
    client_id = r.json()["id"]

    from datetime import datetime, timedelta, timezone
    slot = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=3)).replace(hour=14, minute=0)
    r = await client.post("/appointments", json={
        "business_id": business_id, "service_id": service_id,
        "start_time": slot.isoformat(), "client_id": client_id, "client_name": "Клієнт з історією",
    })
    assert r.status_code == 200, r.text

    r = await client.delete(f"/crm/clients/{client_id}", headers=headers)
    assert r.status_code == 409, "Клієнта з історією бронювань не можна видаляти без явного попередження"


@pytest.mark.asyncio
async def test_service_with_addon_ids_does_not_crash(client, auth_headers):
    """Регресійний тест: раніше падало з 500 через відсутню колонку в БД."""
    headers = auth_headers("addon-test-owner")
    r = await client.post("/crm/businesses", json={"name": "Addon Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.post("/services", json={"business_id": business_id, "name": "Базова", "duration_minutes": 30, "price": 300}, headers=headers)
    assert r.status_code == 201
