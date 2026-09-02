import asyncpg
import pytest
from datetime import datetime, timezone

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _add_master(business_id: int, staff_id: str, **fields):
    cols = {"commission_rate": 50.0, "fixed_salary": 0, "tax_rate": 0,
            "deduct_materials": False, "payout_period": None, **fields}
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "INSERT INTO users (id, email, role, business_id, commission_rate, fixed_salary, tax_rate, "
            "deduct_materials, payout_period, is_active, created_at) "
            "VALUES ($1,$2,'master',$3,$4,$5,$6,$7,$8,true,now()) "
            "ON CONFLICT (id) DO UPDATE SET business_id=$3, commission_rate=$4, fixed_salary=$5, "
            "tax_rate=$6, deduct_materials=$7, payout_period=$8",
            staff_id, f"{staff_id}@test.com", business_id,
            cols["commission_rate"], cols["fixed_salary"], cols["tax_rate"],
            cols["deduct_materials"], cols["payout_period"],
        )
    finally:
        await conn.close()


async def _setup(client, headers, name="Materials Salon", price=1000):
    r = await client.post("/crm/businesses", json={"name": name, "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={"business_id": business_id, "name": "Стрижка",
                                             "duration_minutes": 30, "price": price}, headers=headers)
    return business_id, r.json()["id"]


@pytest.mark.asyncio
async def test_materials_deducted_from_stock_on_completion(client, auth_headers):
    """Завершення візиту списує матеріали зі складу і пише рух."""
    headers = auth_headers("materials-owner")
    business_id, service_id = await _setup(client, headers)

    r = await client.post("/crm/inventory", json={
        "business_id": business_id, "name": "Шампунь", "quantity": 10,
        "unit": "мл", "cost_per_unit": 5,
    }, headers=headers)
    item_id = r.json()["id"]

    # 2 мл шампуню на одну стрижку -> 10 ₴ матеріалів
    r = await client.put(f"/crm/services/{service_id}/materials",
                         json=[{"inventory_item_id": item_id, "quantity_per_use": 2}], headers=headers)
    assert r.status_code == 200
    assert r.json()[0]["cost_per_use"] == 10.0

    await _add_master(business_id, "mat-master")
    slot = datetime.now(timezone.utc).replace(tzinfo=None)
    r = await client.post("/crm/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": slot.isoformat(),
        "master_id": "mat-master", "client_name": "К",
    }, headers=headers)
    appt_id = r.json()["id"]

    # До завершення склад не чіпається
    r = await client.get(f"/crm/inventory?business_id={business_id}", headers=headers)
    assert float(r.json()[0]["quantity"]) == 10.0

    await client.patch(f"/appointments/{appt_id}/status", json={"status": "completed"}, headers=headers)

    r = await client.get(f"/crm/inventory?business_id={business_id}", headers=headers)
    assert float(r.json()[0]["quantity"]) == 8.0, "2 мл мали списатись"

    r = await client.get(f"/crm/inventory/{item_id}/movements", headers=headers)
    assert len(r.json()) == 1
    assert r.json()[0]["reason"] == "service_usage"

    # Повторна зміна статусу на completed НЕ списує вдруге
    await client.patch(f"/appointments/{appt_id}/status", json={"status": "completed"}, headers=headers)
    r = await client.get(f"/crm/inventory?business_id={business_id}", headers=headers)
    assert float(r.json()[0]["quantity"]) == 8.0, "повторне завершення не має списувати ще раз"


@pytest.mark.asyncio
async def test_materials_returned_when_completion_reverted(client, auth_headers):
    """Скасування помилково завершеного візиту повертає матеріали."""
    headers = auth_headers("revert-owner")
    business_id, service_id = await _setup(client, headers, "Revert Salon")

    r = await client.post("/crm/inventory", json={
        "business_id": business_id, "name": "Фарба", "quantity": 5, "unit": "шт", "cost_per_unit": 100,
    }, headers=headers)
    item_id = r.json()["id"]
    await client.put(f"/crm/services/{service_id}/materials",
                     json=[{"inventory_item_id": item_id, "quantity_per_use": 1}], headers=headers)

    await _add_master(business_id, "revert-master")
    slot = datetime.now(timezone.utc).replace(tzinfo=None)
    r = await client.post("/crm/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": slot.isoformat(),
        "master_id": "revert-master", "client_name": "К",
    }, headers=headers)
    appt_id = r.json()["id"]

    await client.patch(f"/appointments/{appt_id}/status", json={"status": "completed"}, headers=headers)
    r = await client.get(f"/crm/inventory?business_id={business_id}", headers=headers)
    assert float(r.json()[0]["quantity"]) == 4.0

    await client.patch(f"/appointments/{appt_id}/status", json={"status": "cancelled"}, headers=headers)
    r = await client.get(f"/crm/inventory?business_id={business_id}", headers=headers)
    assert float(r.json()[0]["quantity"]) == 5.0, "матеріал мав повернутись на склад"


@pytest.mark.asyncio
async def test_materials_cost_deducted_from_payout_when_enabled(client, auth_headers):
    headers = auth_headers("deduct-owner")
    business_id, service_id = await _setup(client, headers, "Deduct Salon", price=1000)

    r = await client.post("/crm/inventory", json={
        "business_id": business_id, "name": "Засіб", "quantity": 100, "unit": "мл", "cost_per_unit": 10,
    }, headers=headers)
    item_id = r.json()["id"]
    await client.put(f"/crm/services/{service_id}/materials",
                     json=[{"inventory_item_id": item_id, "quantity_per_use": 5}], headers=headers)

    # 50% комісії, матеріали віднімаються
    await _add_master(business_id, "deduct-master", commission_rate=50.0, deduct_materials=True)
    slot = datetime.now(timezone.utc).replace(tzinfo=None)
    r = await client.post("/crm/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": slot.isoformat(),
        "master_id": "deduct-master", "client_name": "К",
    }, headers=headers)
    await client.patch(f"/appointments/{r.json()['id']}/status", json={"status": "completed"}, headers=headers)

    r = await client.get(f"/crm/businesses/{business_id}/staff/deduct-master/payout-preview", headers=headers)
    data = r.json()
    # 1000 × 50% = 500 комісії; матеріалів 5×10 = 50; 500 − 50 = 450
    assert float(data["commission_part"]) == 500.0
    assert float(data["materials_cost"]) == 50.0
    assert data["materials_deducted"] is True
    assert float(data["payout_amount"]) == 450.0


@pytest.mark.asyncio
async def test_cancelled_payout_returns_appointments_to_next_period(client, auth_headers):
    """
    Найважливіше при скасуванні: гроші не повинні зникнути. Візити з
    скасованої виплати мають повернутись у наступний розрахунок.
    """
    headers = auth_headers("cancel-payout-owner")
    business_id, service_id = await _setup(client, headers, "Cancel Salon", price=1000)
    await _add_master(business_id, "cancel-master", commission_rate=50.0)

    slot = datetime.now(timezone.utc).replace(tzinfo=None)
    r = await client.post("/crm/appointments", json={
        "business_id": business_id, "service_id": service_id, "start_time": slot.isoformat(),
        "master_id": "cancel-master", "client_name": "К",
    }, headers=headers)
    await client.patch(f"/appointments/{r.json()['id']}/status", json={"status": "completed"}, headers=headers)

    r = await client.post(f"/crm/businesses/{business_id}/staff/cancel-master/payouts", json={}, headers=headers)
    assert r.status_code == 201
    payout_id = r.json()["id"]
    assert float(r.json()["payout_amount"]) == 500.0

    # Після виплати - нуль
    r = await client.get(f"/crm/businesses/{business_id}/staff/cancel-master/payout-preview", headers=headers)
    assert float(r.json()["payout_amount"]) == 0.0

    # Витрата зʼявилась
    r = await client.get(f"/crm/expenses?business_id={business_id}", headers=headers)
    assert any(float(e["amount"]) == 500.0 for e in r.json())

    # Скасовуємо
    r = await client.delete(
        f"/crm/businesses/{business_id}/staff/cancel-master/payouts/{payout_id}?reason=Помилка",
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"

    # Гроші повернулись у розрахунок
    r = await client.get(f"/crm/businesses/{business_id}/staff/cancel-master/payout-preview", headers=headers)
    assert float(r.json()["payout_amount"]) == 500.0, "візити мали повернутись у наступний період"

    # Повʼязана витрата прибрана, щоб не спотворювати звітність
    r = await client.get(f"/crm/expenses?business_id={business_id}", headers=headers)
    assert not any(float(e["amount"]) == 500.0 for e in r.json())


@pytest.mark.asyncio
async def test_due_payouts_list(client, auth_headers):
    """Список 'кому пора платити' за налаштованою періодичністю."""
    headers = auth_headers("due-owner")
    business_id, service_id = await _setup(client, headers, "Due Salon", price=800)
    await _add_master(business_id, "due-master", commission_rate=50.0, payout_period="weekly")
    await _add_master(business_id, "no-period-master", commission_rate=50.0, payout_period=None)

    slot = datetime.now(timezone.utc).replace(tzinfo=None)
    for master in ("due-master", "no-period-master"):
        r = await client.post("/crm/appointments", json={
            "business_id": business_id, "service_id": service_id,
            "start_time": slot.isoformat(), "master_id": master, "client_name": "К",
        }, headers=headers)
        if r.status_code == 201:
            await client.patch(f"/appointments/{r.json()['id']}/status",
                               json={"status": "completed"}, headers=headers)

    r = await client.get(f"/crm/businesses/{business_id}/payouts/due", headers=headers)
    assert r.status_code == 200
    ids = [d["staff_id"] for d in r.json()["due"]]
    assert "due-master" in ids, "майстер з тижневою періодичністю має бути у списку"
    assert "no-period-master" not in ids, "без налаштованої періодичності - не нагадуємо"
