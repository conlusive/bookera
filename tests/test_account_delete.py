"""Видалення власних даних: анонімізація профілю, улюблені, відмова власникам і працівникам."""
from tests.test_audit import DB  # noqa: F401  (рядок підключення до тестової бази)
import asyncpg


async def _q(sql, *args):
    c = await asyncpg.connect(DB)
    try:
        return await c.fetch(sql, *args)
    finally:
        await c.close()


async def test_client_account_is_anonymised(client, auth_headers):
    h = auth_headers("del-client", role="client")
    me = await client.get("/account/me", headers=h)
    assert me.status_code == 200
    await client.patch("/account/me", json={"full_name": "Марія", "phone": "+380671112233"}, headers=h)
    owner = auth_headers("del-owner")
    bid = (await client.post("/crm/businesses", json={"name": "Салон", "city": "Львів"}, headers=owner)).json()["id"]
    await _q("INSERT INTO favorites (user_id, business_id) VALUES ($1, $2)", "del-client", bid)

    r = await client.delete("/account/me", headers=h)
    assert r.status_code == 204

    row = (await _q("SELECT email, full_name, phone, birthday, avatar_url, is_active FROM users WHERE id=$1", "del-client"))[0]
    assert row["email"].startswith("deleted-") and row["full_name"] == "Видалений користувач"
    assert row["phone"] is None and row["birthday"] is None and row["avatar_url"] is None and row["is_active"] is False
    assert not await _q("SELECT 1 FROM favorites WHERE user_id=$1", "del-client")
    # Та сама пошта може зареєструватися знову: службова адреса унікальна, стара звільнена
    from tests.conftest import make_token
    again = await client.get("/account/me", headers={"Authorization": f"Bearer {make_token('del-client-new', 'client', email='del-client@test.com')}"})
    assert again.status_code == 200


async def test_owner_cannot_delete_while_owning_a_business(client, auth_headers):
    h = auth_headers("del-owner2")
    await client.post("/crm/businesses", json={"name": "Мій салон", "city": "Львів"}, headers=h)
    r = await client.delete("/account/me", headers=h)
    assert r.status_code == 409 and "Мій салон" in r.json()["detail"]
    row = (await _q("SELECT email FROM users WHERE id=$1", "del-owner2"))[0]
    assert not row["email"].startswith("deleted-"), "власник не анонімізований"


async def test_delete_without_profile_is_noop(client, auth_headers):
    r = await client.delete("/account/me", headers=auth_headers("never-seen", role="client"))
    assert r.status_code == 204


async def test_active_team_member_cannot_delete_until_leaving(client, auth_headers):
    owner = auth_headers("del-owner3")
    bid = (await client.post("/crm/businesses", json={"name": "Команда", "city": "Львів"}, headers=owner)).json()["id"]
    h = auth_headers("del-master", role="master")
    await client.get("/account/me", headers=h)
    await _q("INSERT INTO staff_memberships (user_id, business_id, role, is_active) VALUES ($1, $2, 'master', true)", "del-master", bid)
    r = await client.delete("/account/me", headers=h)
    assert r.status_code == 409 and "Команда" in r.json()["detail"]
    # вийшов з команди - видалення проходить
    await _q("UPDATE staff_memberships SET is_active=false WHERE user_id=$1", "del-master")
    assert (await client.delete("/account/me", headers=h)).status_code == 204
