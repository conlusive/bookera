import asyncpg
import pytest

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _add_staff(business_id: int, staff_id: str, role: str = "master"):
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "INSERT INTO users (id, email, role, business_id, is_active, created_at) "
            "VALUES ($1, $2, $3, $4, true, now()) "
            "ON CONFLICT (id) DO UPDATE SET business_id=$4, role=$3, is_active=true",
            staff_id, f"{staff_id}@test.com", role, business_id,
        )
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_regular_master_cannot_see_business_finances(client, auth_headers):
    """
    Звичайний майстер не повинен бачити виручку закладу, комісії й бали -
    раніше будь-який співробітник мав той самий доступ, що й власник.
    """
    owner = auth_headers("finance-owner")
    r = await client.post("/crm/businesses", json={"name": "Finance Salon", "city": "Львів"}, headers=owner)
    business_id = r.json()["id"]

    await _add_staff(business_id, "plain-master", role="master")
    master = auth_headers("plain-master")

    # Власник бачить
    r = await client.get(f"/crm/businesses/{business_id}/monetization", headers=owner)
    assert r.status_code == 200

    # Майстер - ні
    for path in [
        f"/crm/businesses/{business_id}/monetization",
        f"/crm/businesses/{business_id}/stats",
        f"/crm/businesses/{business_id}/commissions",
        f"/crm/expenses?business_id={business_id}",
    ]:
        r = await client.get(path, headers=master)
        assert r.status_code == 403, f"{path} мав бути закритий для звичайного майстра"


@pytest.mark.asyncio
async def test_regular_master_cannot_manage_other_staff(client, auth_headers):
    owner = auth_headers("staff-mgmt-owner")
    r = await client.post("/crm/businesses", json={"name": "Staff Mgmt Salon", "city": "Львів"}, headers=owner)
    business_id = r.json()["id"]

    await _add_staff(business_id, "master-a", role="master")
    await _add_staff(business_id, "master-b", role="master")
    master_a = auth_headers("master-a")

    # Не може запросити нового співробітника
    r = await client.post(f"/crm/businesses/{business_id}/invites", json={"email": "x@test.com", "role": "master"}, headers=master_a)
    assert r.status_code == 403

    # Не може звільнити колегу
    r = await client.delete("/crm/staff/master-b", headers=master_a)
    assert r.status_code == 403

    # Не може змінити чужу картку
    r = await client.patch("/crm/staff/master-b", json={"full_name": "Змінено"}, headers=master_a)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_master_can_edit_own_card_but_not_own_salary(client, auth_headers):
    """
    Кожен має право виправити своє імʼя чи телефон, але не підняти собі
    ставку й не змінити власну роль - це справа адміністрації.
    """
    owner = auth_headers("self-edit-owner")
    r = await client.post("/crm/businesses", json={"name": "Self Edit Salon", "city": "Львів"}, headers=owner)
    business_id = r.json()["id"]

    await _add_staff(business_id, "self-master", role="master")
    master = auth_headers("self-master")

    # Своє імʼя - можна
    r = await client.patch("/crm/staff/self-master", json={"full_name": "Нове Імʼя", "phone": "+380671110000"}, headers=master)
    assert r.status_code == 200
    assert r.json()["full_name"] == "Нове Імʼя"

    # Своя ставка і роль - тихо ігноруються (не 403, бо решта полів валідна)
    r = await client.patch("/crm/staff/self-master", json={"commission_rate": 90, "role": "admin"}, headers=master)
    assert r.status_code == 200
    assert r.json()["role"] == "master", "Майстер не може підвищити себе до адміністратора"
    assert not r.json().get("commission_rate"), "Майстер не може призначити собі ставку"


@pytest.mark.asyncio
async def test_deactivated_staff_loses_access(client, auth_headers):
    owner = auth_headers("deactivate-owner")
    r = await client.post("/crm/businesses", json={"name": "Deactivate Salon", "city": "Львів"}, headers=owner)
    business_id = r.json()["id"]

    await _add_staff(business_id, "fired-master", role="master")
    fired = auth_headers("fired-master")

    # Поки активний - бачить клієнтів
    r = await client.get(f"/crm/clients?business_id={business_id}", headers=fired)
    assert r.status_code == 200

    # Власник звільняє
    r = await client.delete("/crm/staff/fired-master", headers=owner)
    assert r.status_code == 204

    # Доступ зник
    r = await client.get(f"/crm/clients?business_id={business_id}", headers=fired)
    assert r.status_code == 403
