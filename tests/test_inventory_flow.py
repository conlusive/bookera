import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _setup(client, auth_headers, tag):
    h = auth_headers(f"inv-owner-{tag}")
    bid = (await client.post("/crm/businesses", json={"name": "Inv", "city": "Львів"}, headers=h)).json()["id"]
    sid = (await client.post("/services", json={"business_id": bid, "name": "Манікюр", "duration_minutes": 60, "price": 600}, headers=h)).json()["id"]
    item = (await client.post("/crm/inventory", json={"business_id": bid, "name": "Гель-лак", "quantity": 10, "unit": "мл", "cost_per_unit": 20, "low_stock_threshold": 3}, headers=h)).json()
    r = await client.put(f"/crm/services/{sid}/materials", json=[{"inventory_item_id": item["id"], "quantity_per_use": 2}], headers=h)
    assert r.status_code == 200, r.text
    return bid, sid, item["id"], h


async def _appt(bid, sid, status="confirmed", hours_ago=2):
    st = local_now().replace(tzinfo=None, microsecond=0) - timedelta(hours=hours_ago)
    conn = await asyncpg.connect(DB)
    try:
        return await conn.fetchval("INSERT INTO appointments (business_id, service_id, client_name, start_time, end_time, status, price, source) "
                                   "VALUES ($1,$2,'Марія',$3,$4,$5,600,'crm') RETURNING id", bid, sid, st, st + timedelta(hours=1), status)
    finally:
        await conn.close()


async def _qty(client, bid, item_id, h):
    return next(i for i in (await client.get("/crm/inventory", params={"business_id": bid}, headers=h)).json() if i["id"] == item_id)["quantity"]


@pytest.mark.asyncio
async def test_toggle_complete_is_consistent(client, auth_headers):
    """
    завершити -> скасувати -> завершити -> скасувати: раніше вдруге не
    списувалось, а повернення додавало двічі. Тепер склад завжди точний.
    """
    bid, sid, item_id, h = await _setup(client, auth_headers, "tog")
    aid = await _appt(bid, sid)
    for status, expected in [("completed", 8), ("cancelled", 10), ("completed", 8), ("cancelled", 10), ("completed", 8)]:
        r = await client.patch(f"/appointments/{aid}/status", json={"status": status}, headers=h)
        assert r.status_code == 200, r.text
        assert float(await _qty(client, bid, item_id, h)) == expected, f"після {status}"


@pytest.mark.asyncio
async def test_crm_route_and_autocomplete_consume(client, auth_headers):
    """Раніше матеріали списувались лише з календаря."""
    bid, sid, item_id, h = await _setup(client, auth_headers, "all")
    a1 = await _appt(bid, sid)
    assert (await client.patch(f"/crm/appointments/{a1}", json={"status": "completed"}, headers=h)).status_code == 200
    assert float(await _qty(client, bid, item_id, h)) == 8, "CRM"

    await _appt(bid, sid, hours_ago=2)   # закінчився годину тому - автозавершення
    from app.core.database import AsyncSessionLocal
    from app.services.reminders import complete_past_appointments
    async with AsyncSessionLocal() as db:
        assert await complete_past_appointments(db) >= 1
    assert float(await _qty(client, bid, item_id, h)) == 6, "автозавершення (і за київським часом, а не UTC)"


@pytest.mark.asyncio
async def test_restock_adds_stock_expense_and_history(client, auth_headers):
    bid, sid, item_id, h = await _setup(client, auth_headers, "rs")
    r = await client.post(f"/crm/inventory/{item_id}/restock", json={"quantity": 50, "cost_per_unit": 18}, headers=h)
    assert r.status_code == 200, r.text
    assert float(r.json()["quantity"]) == 60 and float(r.json()["cost_per_unit"]) == 18
    exp = (await client.get("/crm/expenses", params={"business_id": bid}, headers=h)).json()
    assert any(e["category"] == "Матеріали" and float(e["amount"]) == 900 for e in exp), "закупівля - у витратах"

    await client.patch(f"/crm/inventory/{item_id}", json={"quantity": 55}, headers=h)   # інвентаризація
    moves = (await client.get(f"/crm/inventory/{item_id}/movements", headers=h)).json()
    assert [m["reason"] for m in moves][:3] == ["adjustment", "restock", "initial"]
    assert sum(m["quantity_delta"] for m in moves) == 55, "історія сходиться з залишком"

    r = await client.post(f"/crm/inventory/{item_id}/restock", json={"quantity": 5, "add_expense": False}, headers=h)
    assert float(r.json()["quantity"]) == 60
    assert len((await client.get("/crm/expenses", params={"business_id": bid}, headers=h)).json()) == 1, "без витрати - на вимогу"


@pytest.mark.asyncio
async def test_inventory_and_expense_validation(client, auth_headers):
    bid, sid, item_id, h = await _setup(client, auth_headers, "val")
    bad_items = [
        {"name": "  ", "quantity": 1},
        {"name": "X", "quantity": -1},
        {"name": "X", "cost_per_unit": -5},
        {"name": "X", "low_stock_threshold": -1},
    ]
    for body in bad_items:
        r = await client.post("/crm/inventory", json={"business_id": bid, **body}, headers=h)
        assert r.status_code == 422, body
    assert (await client.patch(f"/crm/inventory/{item_id}", json={"quantity": -3}, headers=h)).status_code == 422

    for amount in (0, -100):
        r = await client.post("/crm/expenses", json={"business_id": bid, "amount": amount}, headers=h)
        assert r.status_code == 422, amount
    r = await client.post("/crm/expenses", json={"business_id": bid, "amount": 100}, headers=h)
    assert r.status_code == 201
    assert (await client.patch(f"/crm/expenses/{r.json()['id']}", json={"amount": 0}, headers=h)).status_code == 422
    assert (await client.post(f"/crm/inventory/{item_id}/restock", json={"quantity": 0}, headers=h)).status_code == 422


@pytest.mark.asyncio
async def test_series_edit_applies_category_and_description(client, auth_headers):
    bid, sid, item_id, h = await _setup(client, auth_headers, "ser")
    first = (await client.post("/crm/expenses", json={
        "business_id": bid, "category": "Оренда", "description": "Старе", "amount": 100,
        "expense_date": "2026-09-01", "recurrence": "monthly"}, headers=h)).json()
    r = await client.patch(f"/crm/expenses/{first['id']}", json={
        "category": "Комунальні", "description": "Нове", "apply_to_future": True}, headers=h)
    assert r.status_code == 200
    rows = [e for e in (await client.get("/crm/expenses", params={"business_id": bid}, headers=h)).json()
            if e["recurrence_group_id"] == first["recurrence_group_id"]]
    assert len(rows) == 13
    assert all(e["category"] == "Комунальні" and e["description"] == "Нове" for e in rows)


@pytest.mark.asyncio
async def test_other_business_cannot_touch_inventory(client, auth_headers):
    bid, sid, item_id, h = await _setup(client, auth_headers, "iso")
    h2 = auth_headers("iso-intruder")
    await client.post("/crm/businesses", json={"name": "Other", "city": "Львів"}, headers=h2)
    for method, url, body in [
        ("patch", f"/crm/inventory/{item_id}", {"quantity": 1}),
        ("post", f"/crm/inventory/{item_id}/restock", {"quantity": 1}),
        ("get", f"/crm/inventory/{item_id}/movements", None),
        ("delete", f"/crm/inventory/{item_id}", None),
    ]:
        r = await getattr(client, method)(url, headers=h2, **({"json": body} if body else {}))
        assert r.status_code in (403, 404), (method, url, r.status_code)
    assert float(await _qty(client, bid, item_id, h)) > 0
