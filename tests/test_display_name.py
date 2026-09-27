import asyncpg
import pytest

from tests.conftest import make_token

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


def _h(uid, name=None, role="business_owner"):
    return {"Authorization": f"Bearer {make_token(uid, role, full_name=name)}"}


@pytest.mark.asyncio
async def test_name_from_signup_reaches_cabinet(client):
    """
    Імʼя з реєстрації лежить у токені, але в таблицю не переносилось:
    кабінет бачив порожнє імʼя й показував пошту.
    """
    uid = "dn-owner"
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("INSERT INTO users (id, email, role, is_active, created_at) VALUES ($1,$2,'business_owner',true,now())",
                           uid, "olena@example.com")
    finally:
        await conn.close()
    me = (await client.get("/crm/businesses/me", headers=_h(uid, "Олена Коваль"))).json()
    assert me["full_name"] == "Олена Коваль"
    assert (await client.get("/account/me", headers=_h(uid))).json()["full_name"] == "Олена Коваль", "збережено в базі"


@pytest.mark.asyncio
async def test_name_changed_in_profile_not_overwritten(client):
    """Лише доповнює порожнє: імʼя, змінене в профілі, лишається."""
    uid = "dn-renamed"
    await client.patch("/account/me", json={"full_name": "Олена К."}, headers=_h(uid, "Olena"))
    me = (await client.get("/crm/businesses/me", headers=_h(uid, "Olena"))).json()
    assert me["full_name"] == "Олена К."


@pytest.mark.asyncio
async def test_new_client_gets_name_from_token(client):
    r = (await client.get("/account/me", headers=_h("dn-new", "Марія", role="client"))).json()
    assert r["full_name"] == "Марія"
