import pytest
from datetime import datetime, timedelta, timezone


@pytest.mark.asyncio
async def test_client_with_points_history_cannot_be_deleted(client, auth_headers):
    """Регресійний тест: раніше падало сирою IntegrityError замість чіткого 409."""
    headers = auth_headers("points-delete-owner")
    r = await client.post("/crm/businesses", json={"name": "Points Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.post("/crm/clients", json={
        "business_id": business_id, "name": "Новий Клієнт", "phone": "+380509998877",
    }, headers=headers)
    client_id = r.json()["id"]

    r = await client.get(f"/crm/businesses/{business_id}/monetization", headers=headers)
    assert r.json()["points_balance"] == 10, "Новий для екосистеми клієнт має дати 10 балів"

    r = await client.delete(f"/crm/clients/{client_id}", headers=headers)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_points_not_awarded_for_client_already_known_elsewhere(client, auth_headers):
    """Той самий телефон у ДРУГОМУ бізнесі - бали не нараховуються (не новий для екосистеми)."""
    headers_a = auth_headers("dup-phone-owner-a")
    headers_b = auth_headers("dup-phone-owner-b")

    r = await client.post("/crm/businesses", json={"name": "Salon A", "city": "Львів"}, headers=headers_a)
    business_a = r.json()["id"]
    r = await client.post("/crm/businesses", json={"name": "Salon B", "city": "Львів"}, headers=headers_b)
    business_b = r.json()["id"]

    await client.post("/crm/clients", json={"business_id": business_a, "name": "Хтось", "phone": "+380661112200"}, headers=headers_a)

    r = await client.post("/crm/clients", json={"business_id": business_b, "name": "Той самий", "phone": "+380661112200"}, headers=headers_b)
    assert r.status_code == 201

    r = await client.get(f"/crm/businesses/{business_b}/monetization", headers=headers_b)
    assert r.json()["points_balance"] == 0, "Телефон уже відомий системі - бали другому бізнесу не належать"


@pytest.mark.asyncio
async def test_radar_activation_with_points_and_search_ranking(client, auth_headers):
    headers = auth_headers("radar-owner")
    r = await client.post("/crm/businesses", json={"name": "Radar Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    # без балів - 402
    r = await client.post(f"/crm/businesses/{business_id}/radar/activate-with-points", json={"days": 7}, headers=headers)
    assert r.status_code == 402

    # даємо клієнтів, щоб назбирати бали (10 балів/новий клієнт, потрібно 7*15=105 -> 11 клієнтів)
    for i in range(11):
        await client.post("/crm/clients", json={
            "business_id": business_id, "name": f"Клієнт {i}", "phone": f"+38050000{i:04d}",
        }, headers=headers)

    r = await client.post(f"/crm/businesses/{business_id}/radar/activate-with-points", json={"days": 7}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["active"] is True

    r = await client.get(f"/crm/businesses/{business_id}/radar", headers=headers)
    assert r.json()["active"] is True

    # активний radar-бізнес має бути першим у публічному списку
    r = await client.get("/businesses/")
    ids = [b["id"] for b in r.json()]
    assert ids[0] == business_id


@pytest.mark.asyncio
async def test_gift_certificate_applies_discount_to_booking(client, auth_headers):
    headers = auth_headers("gift-owner")
    r = await client.post("/crm/businesses", json={"name": "Gift Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={"business_id": business_id, "name": "Стрижка", "duration_minutes": 30, "price": 500}, headers=headers)
    service_id = r.json()["id"]

    r = await client.post("/crm/gift-certificates", json={"business_id": business_id, "amount": 200}, headers=headers)
    assert r.status_code == 201
    code = r.json()["code"]

    r = await client.post("/public/gift-certificates/check", json={"code": code, "business_id": business_id})
    assert r.json()["valid"] is True
    assert float(r.json()["remaining_amount"]) == 200.0

    slot = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)).replace(hour=10, minute=0)
    r = await client.post("/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": slot.isoformat(),
        "client_name": "Тест", "client_email": "t2@t.com", "gift_certificate_code": code,
    })
    assert r.status_code == 200
    assert float(r.json()["price"]) == 300.0, "500 - 200 (сертифікат) = 300"

    r = await client.post("/public/gift-certificates/check", json={"code": code, "business_id": business_id})
    assert r.json()["valid"] is False, "Сертифікат вичерпано, має стати недійсним"


@pytest.mark.asyncio
async def test_commission_charged_on_completed_marketplace_booking(client, auth_headers):
    """Комісія нараховується при завершенні маркетплейс-візиту, і НЕ нараховується за прямий."""
    headers = auth_headers("commission-owner")
    r = await client.post("/crm/businesses", json={"name": "Commission Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={"business_id": business_id, "name": "Стрижка", "duration_minutes": 30, "price": 1000}, headers=headers)
    service_id = r.json()["id"]

    r = await client.get(f"/crm/businesses/{business_id}/monetization", headers=headers)
    real_token = r.json()["direct_link_token"]

    # маркетплейс-бронювання (без direct_link_token)
    slot1 = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)).replace(hour=9, minute=0)
    r = await client.post("/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": slot1.isoformat(),
        "client_name": "М", "client_email": "m@t.com",
    })
    marketplace_appt_id = r.json()["id"]

    # пряме бронювання (з правильним токеном)
    slot2 = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)).replace(hour=10, minute=0)
    r = await client.post("/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": slot2.isoformat(),
        "client_name": "П", "client_email": "p@t.com", "direct_link_token": real_token,
    })
    direct_appt_id = r.json()["id"]

    # завершуємо обидва
    await client.patch(f"/appointments/{marketplace_appt_id}/status", json={"status": "completed"}, headers=headers)
    await client.patch(f"/appointments/{direct_appt_id}/status", json={"status": "completed"}, headers=headers)

    r = await client.get(f"/crm/businesses/{business_id}/commissions", headers=headers)
    commissions = r.json()
    assert len(commissions) == 1, "Комісія має нарахуватись лише за маркетплейс-візит"
    assert commissions[0]["appointment_id"] == marketplace_appt_id
    assert float(commissions[0]["amount"]) == 100.0, "10% (дефолтна ставка) з 1000 = 100"

    r = await client.get(f"/crm/businesses/{business_id}/monetization", headers=headers)
    assert float(r.json()["total_commission_owed"]) == 100.0

    # повторна зміна статусу на completed не повинна подвоїти комісію
    await client.patch(f"/appointments/{marketplace_appt_id}/status", json={"status": "confirmed"}, headers=headers)
    await client.patch(f"/appointments/{marketplace_appt_id}/status", json={"status": "completed"}, headers=headers)
    r = await client.get(f"/crm/businesses/{business_id}/commissions", headers=headers)
    assert len(r.json()) == 1, "Комісія не повинна нараховуватись повторно за той самий візит"


@pytest.mark.asyncio
async def test_direct_link_token_prevents_commission_source(client, auth_headers):
    """Регресійний тест на закриту діру: source визначає сервер, не клієнт."""
    headers = auth_headers("direct-link-owner")
    r = await client.post("/crm/businesses", json={"name": "Direct Salon", "city": "Львів"}, headers=headers)
    business = r.json()
    business_id = business["id"]

    r = await client.get(f"/crm/businesses/{business_id}/monetization", headers=headers)
    real_token = r.json()["direct_link_token"]
    assert real_token, "У бізнесу має бути власний direct_link_token одразу після реєстрації"

    r = await client.post("/services", json={"business_id": business_id, "name": "Стрижка", "duration_minutes": 30, "price": 500}, headers=headers)
    service_id = r.json()["id"]

    slot1 = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)).replace(hour=9, minute=0)
    r = await client.post("/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": slot1.isoformat(),
        "client_name": "А", "client_email": "a@t.com", "direct_link_token": real_token,
    })
    assert r.json()["source"] == "direct"

    slot2 = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)).replace(hour=10, minute=0)
    r = await client.post("/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": slot2.isoformat(),
        "client_name": "Б", "client_email": "b@t.com", "direct_link_token": "вигаданий-токен-навмання",
    })
    assert r.json()["source"] == "marketplace", "Підроблений/невірний токен не повинен давати 'direct'"
