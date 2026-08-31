import pytest
from datetime import datetime, timedelta, timezone


@pytest.mark.asyncio
async def test_payout_preview_and_creation(client, auth_headers):
    owner_headers = auth_headers("payout-owner")
    r = await client.post("/crm/businesses", json={"name": "Payout Salon", "city": "Львів"}, headers=owner_headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={"business_id": business_id, "name": "Стрижка", "duration_minutes": 30, "price": 1000}, headers=owner_headers)
    service_id = r.json()["id"]

    # Запрошуємо майстра (перевірка самого запрошення вже покрита іншим тестом)
    await client.post(f"/crm/businesses/{business_id}/invites", json={"email": "master@test.com", "role": "master"}, headers=owner_headers)

    master_headers = auth_headers("payout-master")
    # Пряме прийняття запрошення тут не тестуємо (покрито окремо) - симулюємо
    # вже прийняте запрошення прямим записом майстра з commission_rate.
    import asyncpg
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/bookera_test")
    await conn.execute(
        "INSERT INTO users (id, email, role, business_id, commission_rate, is_active, created_at) "
        "VALUES ($1, $2, 'master', $3, 40.0, true, now()) "
        "ON CONFLICT (id) DO UPDATE SET business_id=$3, commission_rate=40.0",
        "payout-master", "master@test.com", business_id,
    )
    await conn.close()

    # Ручний запис, закритий (виконана послуга майстром). Без зсуву в часі -
    # бізнес щойно створений (period_start = business.created_at ~ "зараз"),
    # тому і "5 хв тому", і "5 хв вперед" ризикують випасти за межі вузького
    # вікна [business.created_at, "зараз" на момент виклику preview].
    slot = datetime.now(timezone.utc).replace(tzinfo=None)
    r = await client.post("/crm/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": slot.isoformat(),
        "master_id": "payout-master", "client_name": "Клієнт",
    }, headers=owner_headers)
    appt_id = r.json()["id"]
    await client.patch(f"/appointments/{appt_id}/status", json={"status": "completed"}, headers=owner_headers)

    # Preview: 1000 * 40% = 400
    r = await client.get(f"/crm/businesses/{business_id}/staff/payout-master/payout-preview", headers=owner_headers)
    assert r.status_code == 200, r.text
    assert float(r.json()["payout_amount"]) == 400.0

    # Фіксація виплати
    r = await client.post(f"/crm/businesses/{business_id}/staff/payout-master/payouts", json={}, headers=owner_headers)
    assert r.status_code == 201, r.text
    assert float(r.json()["payout_amount"]) == 400.0

    # Витрата має з'явитись автоматично
    r = await client.get(f"/crm/expenses?business_id={business_id}", headers=owner_headers)
    assert any(float(e["amount"]) == 400.0 and e["category"] == "Виплата майстру" for e in r.json())

    # Новий preview одразу після виплати - той самий візит не має враховуватись повторно
    r = await client.get(f"/crm/businesses/{business_id}/staff/payout-master/payout-preview", headers=owner_headers)
    assert float(r.json()["payout_amount"]) == 0.0

    # Спроба виплатити ще раз без нових завершених візитів - 400
    r = await client.post(f"/crm/businesses/{business_id}/staff/payout-master/payouts", json={}, headers=owner_headers)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_transfer_ownership(client, auth_headers):
    owner_headers = auth_headers("transfer-owner")
    r = await client.post("/crm/businesses", json={"name": "Transfer Salon", "city": "Львів"}, headers=owner_headers)
    business_id = r.json()["id"]

    import asyncpg
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/bookera_test")
    await conn.execute(
        "INSERT INTO users (id, email, role, business_id, is_active, created_at) "
        "VALUES ($1, $2, 'admin', $3, true, now()) ON CONFLICT (id) DO UPDATE SET business_id=$3",
        "transfer-target", "target@test.com", business_id,
    )
    await conn.close()

    # Не-власник не може передати права
    intruder_headers = auth_headers("transfer-intruder")
    r = await client.post(f"/crm/businesses/{business_id}/transfer-ownership", json={"new_owner_user_id": "transfer-target"}, headers=intruder_headers)
    assert r.status_code == 403

    # Не можна передати самому собі
    r = await client.post(f"/crm/businesses/{business_id}/transfer-ownership", json={"new_owner_user_id": "transfer-owner"}, headers=owner_headers)
    assert r.status_code == 400

    # Успішна передача
    r = await client.post(f"/crm/businesses/{business_id}/transfer-ownership", json={"new_owner_user_id": "transfer-target"}, headers=owner_headers)
    assert r.status_code == 200, r.text
    assert r.json()["new_owner_id"] == "transfer-target"

    # Колишній власник ЛИШАЄТЬСЯ staff (роль admin) - доступ до звичайних CRM
    # даних не втрачає, це навмисно (не хочемо, щоб людина втратила видимість
    # своєї ж роботи). Але власником він вже не є - повторна спроба
    # передати права (дія, яку може робити ЛИШЕ реальний власник) тепер
    # відхиляється - це і є справжній доказ, що owner_id реально змінився.
    r = await client.post(f"/crm/businesses/{business_id}/transfer-ownership", json={"new_owner_user_id": "transfer-owner"}, headers=owner_headers)
    assert r.status_code == 403, "Колишній власник більше не має права передавати права - owner_id реально змінився"
