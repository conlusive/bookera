import asyncpg
import pytest

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _invite_and_accept(client, owner_headers, business_id, email, guest_headers, role="master"):
    """Запрошує людину в заклад і приймає запрошення від її імені."""
    r = await client.post(f"/crm/businesses/{business_id}/invites",
                          json={"email": email, "role": role}, headers=owner_headers)
    assert r.status_code in (200, 201), r.text
    invite_id = r.json()["id"]

    # Схема відповіді свідомо не віддає токен - він іде листом.
    # У тесті беремо його з бази.
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        token = await conn.fetchval("SELECT token FROM staff_invites WHERE id = $1", invite_id)
    finally:
        await conn.close()

    r = await client.post("/public/invites/accept", json={"token": token}, headers=guest_headers)
    assert r.status_code == 200, r.text
    return token


@pytest.mark.asyncio
async def test_master_can_work_in_two_businesses(client, auth_headers):
    """
    Реальність, якої не було в моделі: майстер манікюру працює у двох
    салонах. Раніше звʼязок був одним полем user.business_id, тому
    таким людям доводилось заводити другий обліковий запис.
    """
    owner_a = auth_headers("multi-owner-a")
    owner_b = auth_headers("multi-owner-b")
    master = auth_headers("multi-master")

    r = await client.post("/crm/businesses", json={"name": "Salon A", "city": "Львів"}, headers=owner_a)
    biz_a = r.json()["id"]
    r = await client.post("/crm/businesses", json={"name": "Salon B", "city": "Київ"}, headers=owner_b)
    biz_b = r.json()["id"]

    await _invite_and_accept(client, owner_a, biz_a, "multi-master@test.com", master)
    await _invite_and_accept(client, owner_b, biz_b, "multi-master@test.com", master)

    r = await client.get("/crm/businesses/my-workplaces", headers=master)
    assert r.status_code == 200, r.text
    places = r.json()
    assert len(places) == 2, f"майстер має бачити обидва заклади: {places}"
    assert {p["name"] for p in places} == {"Salon A", "Salon B"}

    # Поточний - лише один
    assert sum(1 for p in places if p["is_current"]) == 1


@pytest.mark.asyncio
async def test_switching_workplace_changes_current_business(client, auth_headers):
    owner_a = auth_headers("switch-owner-a")
    owner_b = auth_headers("switch-owner-b")
    master = auth_headers("switch-master")

    r = await client.post("/crm/businesses", json={"name": "Switch A", "city": "Львів"}, headers=owner_a)
    biz_a = r.json()["id"]
    r = await client.post("/crm/businesses", json={"name": "Switch B", "city": "Київ"}, headers=owner_b)
    biz_b = r.json()["id"]

    await _invite_and_accept(client, owner_a, biz_a, "switch-master@test.com", master)
    await _invite_and_accept(client, owner_b, biz_b, "switch-master@test.com", master, role="admin")

    # Після другого запрошення поточний - Salon B
    r = await client.get("/crm/businesses/me", headers=master)
    assert r.json()["business_id"] == biz_b

    r = await client.post("/crm/businesses/switch-workplace", json={"business_id": biz_a}, headers=master)
    assert r.status_code == 200, r.text
    assert r.json()["business_id"] == biz_a

    # Роль теж перемкнулась: одна людина може бути майстром в одному
    # закладі й адміністратором в іншому
    assert r.json()["role"] == "master"

    r = await client.get("/crm/businesses/me", headers=master)
    assert r.json()["business_id"] == biz_a


@pytest.mark.asyncio
async def test_cannot_switch_to_foreign_business(client, auth_headers):
    """Перемкнутись у заклад, де не працюєш, неможливо."""
    owner = auth_headers("foreign-owner")
    stranger = auth_headers("foreign-stranger")

    r = await client.post("/crm/businesses", json={"name": "Foreign Salon", "city": "Львів"}, headers=owner)
    business_id = r.json()["id"]

    r = await client.post("/crm/businesses/switch-workplace",
                          json={"business_id": business_id}, headers=stranger)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_removal_from_one_business_keeps_the_other(client, auth_headers):
    """
    Звільнення з одного закладу не має викидати людину з решти:
    той заклад до цього рішення стосунку не має.
    """
    owner_a = auth_headers("keep-owner-a")
    owner_b = auth_headers("keep-owner-b")
    master = auth_headers("keep-master")

    r = await client.post("/crm/businesses", json={"name": "Keep A", "city": "Львів"}, headers=owner_a)
    biz_a = r.json()["id"]
    r = await client.post("/crm/businesses", json={"name": "Keep B", "city": "Київ"}, headers=owner_b)
    biz_b = r.json()["id"]

    await _invite_and_accept(client, owner_a, biz_a, "keep-master@test.com", master)
    await _invite_and_accept(client, owner_b, biz_b, "keep-master@test.com", master)

    # Дізнаємось id майстра
    r = await client.get("/crm/businesses/me", headers=master)
    master_id = r.json()["id"]

    # Власник A звільняє майстра
    r = await client.delete(f"/crm/staff/{master_id}?business_id={biz_a}", headers=owner_a)
    assert r.status_code in (200, 204), r.text

    r = await client.get("/crm/businesses/my-workplaces", headers=master)
    places = r.json()
    assert len(places) == 1, "має лишитись один заклад"
    assert places[0]["name"] == "Keep B"

    # І людина не лишилась без закладу взагалі
    r = await client.get("/crm/businesses/me", headers=master)
    assert r.json()["business_id"] == biz_b
