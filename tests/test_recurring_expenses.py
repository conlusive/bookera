import pytest
from datetime import date


@pytest.mark.asyncio
async def test_recurring_monthly_expense_generates_12_future_entries(client, auth_headers):
    headers = auth_headers("recur-owner")
    r = await client.post("/crm/businesses", json={"name": "Recur Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.post("/crm/expenses", json={
        "business_id": business_id, "category": "Оренда", "description": "Приміщення",
        "amount": 15000, "expense_date": "2026-09-01", "recurrence": "monthly",
    }, headers=headers)
    assert r.status_code == 201
    group_id = r.json()["recurrence_group_id"]
    assert group_id is not None

    r = await client.get(f"/crm/expenses?business_id={business_id}", headers=headers)
    all_expenses = r.json()
    same_group = [e for e in all_expenses if e["recurrence_group_id"] == group_id]
    assert len(same_group) == 13, "1 оригінал + 12 майбутніх щомісячних входжень"

    dates = sorted(e["expense_date"] for e in same_group)
    assert dates[0] == "2026-09-01"
    assert dates[-1] == "2027-09-01", "останнє входження - рівно через 12 місяців"


@pytest.mark.asyncio
async def test_editing_recurring_expense_can_shift_future_entries(client, auth_headers):
    headers = auth_headers("recur-edit-owner")
    r = await client.post("/crm/businesses", json={"name": "Recur Edit Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.post("/crm/expenses", json={
        "business_id": business_id, "category": "Оренда", "amount": 10000,
        "expense_date": "2026-09-05", "recurrence": "monthly",
    }, headers=headers)
    original_id = r.json()["id"]
    group_id = r.json()["recurrence_group_id"]

    # Зсуваємо дату оригіналу на +3 дні і суму на 12000, з поширенням на майбутнє
    r = await client.patch(f"/crm/expenses/{original_id}", json={
        "expense_date": "2026-09-08", "amount": 12000, "apply_to_future": True,
    }, headers=headers)
    assert r.status_code == 200
    assert r.json()["expense_date"] == "2026-09-08"

    r = await client.get(f"/crm/expenses?business_id={business_id}", headers=headers)
    same_group = [e for e in r.json() if e["recurrence_group_id"] == group_id and e["id"] != original_id]
    assert len(same_group) == 12
    # Усі майбутні мають зсунутись на ті самі +3 дні і отримати нову суму
    assert all(float(e["amount"]) == 12000.0 for e in same_group)
    assert all(int(e["expense_date"].split("-")[2]) == 8 for e in same_group), "день місяця має стати 8 у всіх майбутніх"


@pytest.mark.asyncio
async def test_delete_recurring_expense_with_future_removes_whole_series(client, auth_headers):
    headers = auth_headers("recur-delete-owner")
    r = await client.post("/crm/businesses", json={"name": "Recur Delete Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.post("/crm/expenses", json={
        "business_id": business_id, "category": "Інтернет", "amount": 500,
        "expense_date": "2026-09-01", "recurrence": "monthly",
    }, headers=headers)
    original_id = r.json()["id"]

    r = await client.delete(f"/crm/expenses/{original_id}?delete_future=true", headers=headers)
    assert r.status_code == 204

    r = await client.get(f"/crm/expenses?business_id={business_id}", headers=headers)
    assert len(r.json()) == 0, "Вся серія (13 записів) має зникнути одним запитом"


@pytest.mark.asyncio
async def test_non_recurring_expense_has_no_group(client, auth_headers):
    headers = auth_headers("single-expense-owner")
    r = await client.post("/crm/businesses", json={"name": "Single Expense Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.post("/crm/expenses", json={
        "business_id": business_id, "category": "Одноразова", "amount": 200, "expense_date": "2026-09-01",
    }, headers=headers)
    assert r.status_code == 201
    assert r.json()["recurrence_group_id"] is None

    r = await client.get(f"/crm/expenses?business_id={business_id}", headers=headers)
    assert len(r.json()) == 1, "Без recurrence не мало створитись жодних майбутніх копій"
