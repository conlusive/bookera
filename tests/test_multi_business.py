import asyncpg
import pytest

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


@pytest.mark.asyncio
async def test_two_businesses_on_one_account_both_switchable(client, auth_headers):
    """
    Ваш сценарій: два заклади на одному акаунті. Раніше в перемикачі був
    лише один, а перемкнутись на другий не давало «ви не працюєте тут».
    """
    h = auth_headers("multi-owner")
    a = (await client.post("/crm/businesses", json={"name": "Перший", "city": "Львів"}, headers=h)).json()["id"]
    b = (await client.post("/crm/businesses", json={"name": "Другий", "city": "Львів"}, headers=h)).json()["id"]

    places = (await client.get("/crm/businesses/my-workplaces", headers=h)).json()
    assert {p["business_id"] for p in places} == {a, b}, "обидва заклади в перемикачі"

    r = await client.post("/crm/businesses/switch-workplace", json={"business_id": a}, headers=h)
    assert r.status_code == 200, r.text
    me = (await client.get("/crm/businesses/me", headers=h)).json()
    assert me["business_id"] == a, "перемкнулось на перший"

    r = await client.post("/crm/businesses/switch-workplace", json={"business_id": b}, headers=h)
    assert r.status_code == 200
    assert (await client.get("/crm/businesses/me", headers=h)).json()["business_id"] == b


@pytest.mark.asyncio
async def test_owned_business_without_membership_is_repaired(client, auth_headers):
    """Заклад, створений до виправлення (без членства), зʼявляється й перемикається."""
    h = auth_headers("legacy-owner")
    bid = (await client.post("/crm/businesses", json={"name": "Старий", "city": "Львів"}, headers=h)).json()["id"]
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("DELETE FROM staff_memberships WHERE business_id = $1", bid)
    finally:
        await conn.close()

    places = (await client.get("/crm/businesses/my-workplaces", headers=h)).json()
    assert bid in {p["business_id"] for p in places}
    r = await client.post("/crm/businesses/switch-workplace", json={"business_id": bid}, headers=h)
    assert r.status_code == 200, "членство відновлено - перемикання працює"


@pytest.mark.asyncio
async def test_cannot_switch_to_someone_elses_business(client, auth_headers):
    other = (await client.post("/crm/businesses", json={"name": "Чужий", "city": "Львів"}, headers=auth_headers("stranger"))).json()["id"]
    r = await client.post("/crm/businesses/switch-workplace", json={"business_id": other}, headers=auth_headers("intruder"))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_deleting_one_of_two_keeps_owner_on_the_other(client, auth_headers):
    """Власник двох закладів, що видалив один, - власник другого, а не клієнт."""
    h = auth_headers("two-then-one")
    a = (await client.post("/crm/businesses", json={"name": "Лишається", "city": "Львів"}, headers=h)).json()["id"]
    b = (await client.post("/crm/businesses", json={"name": "Видаляю", "city": "Львів"}, headers=h)).json()["id"]

    r = await client.request("DELETE", f"/crm/businesses/{b}", json={"confirm_name": "Видаляю"}, headers=h)
    assert r.status_code == 204, r.text

    me = (await client.get("/crm/businesses/me", headers=h)).json()
    assert me["business_id"] == a, "перемкнуло на заклад, що лишився"
    places = (await client.get("/crm/businesses/my-workplaces", headers=h)).json()
    assert [p["business_id"] for p in places] == [a]
