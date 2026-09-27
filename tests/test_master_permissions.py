import asyncpg
import pytest

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _salon_with_masters(client, auth_headers, tag):
    owner = auth_headers(f"perm-owner-{tag}")
    bid = (await client.post("/crm/businesses", json={"name": "Perm", "city": "Львів"}, headers=owner)).json()["id"]
    conn = await asyncpg.connect(DB)
    try:
        for m in (f"perm-m1-{tag}", f"perm-m2-{tag}"):
            await conn.execute(
                "INSERT INTO users (id, email, role, is_active, created_at, business_id) VALUES ($1,$2,'master',true,now(),$3)",
                m, f"{m}@example.com", bid)
            await conn.execute(
                "INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at) VALUES ($1,$2,'master',true,now())",
                m, bid)
    finally:
        await conn.close()
    # Послуга - справжнім маршрутом від власника, з усіма полями.
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 500},
                             headers=owner)).json()["id"]
    return owner, bid, sid, auth_headers(f"perm-m1-{tag}")


@pytest.mark.asyncio
async def test_master_cannot_change_services(client, auth_headers):
    """Раніше будь-який майстер міг змінити чи видалити послугу одним запитом."""
    owner, bid, sid, master = await _salon_with_masters(client, auth_headers, "svc")
    assert (await client.patch(f"/services/{sid}", json={"price": 1}, headers=master)).status_code == 403
    assert (await client.delete(f"/services/{sid}", headers=master)).status_code == 403
    r = await client.post("/services", json={"business_id": bid, "name": "Нова послуга", "duration_minutes": 30, "price": 400}, headers=master)
    assert r.status_code == 403
    # власник - може
    assert (await client.patch(f"/services/{sid}", json={"price": 600}, headers=owner)).status_code == 200


@pytest.mark.asyncio
async def test_master_cannot_touch_inventory(client, auth_headers):
    owner, bid, sid, master = await _salon_with_masters(client, auth_headers, "inv")
    r = await client.post("/crm/inventory", json={"business_id": bid, "name": "Фарба", "quantity": 1}, headers=master)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_master_sees_own_pay_not_colleagues(client, auth_headers):
    """
    Раніше майстер отримував 403 навіть на ВЛАСНУ зарплату. Тепер свою
    бачить, а чужу - як і раніше, ні.
    """
    owner, bid, sid, master = await _salon_with_masters(client, auth_headers, "pay")
    me, colleague = "perm-m1-pay", "perm-m2-pay"
    assert (await client.get(f"/crm/businesses/{bid}/staff/{me}/payout-preview", headers=master)).status_code == 200
    assert (await client.get(f"/crm/businesses/{bid}/staff/{me}/payouts", headers=master)).status_code == 200
    assert (await client.get(f"/crm/businesses/{bid}/staff/{colleague}/payout-preview", headers=master)).status_code == 403
    assert (await client.get(f"/crm/businesses/{bid}/staff/{colleague}/payouts", headers=master)).status_code == 403


@pytest.mark.asyncio
async def test_master_cannot_pay_himself(client, auth_headers):
    """Бачити свою зарплату - так; фіксувати виплату собі - ні."""
    owner, bid, sid, master = await _salon_with_masters(client, auth_headers, "self")
    r = await client.post(f"/crm/businesses/{bid}/staff/perm-m1-self/payouts", json={}, headers=master)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_work_me_filters_to_one_business(client, auth_headers):
    owner, bid, sid, master = await _salon_with_masters(client, auth_headers, "work")
    r = await client.get("/work/me", params={"business_id": bid}, headers=master)
    assert r.status_code == 200, r.text
    assert [w["business_id"] for w in r.json()["workplaces"]] == [bid]
