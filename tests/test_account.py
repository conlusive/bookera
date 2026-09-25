import pytest


@pytest.mark.asyncio
async def test_update_name_phone_and_avatar(client, auth_headers):
    """Раніше збереження падало: профіль писав у неіснуючу таблицю profiles."""
    h = auth_headers("acc-1")
    r = await client.patch("/account/me", headers=h, json={
        "full_name": "  Ярослав К.  ", "phone": "+380 67 123 45 67",
        "avatar_url": "https://x.supabase.co/storage/v1/object/public/avatars/a.jpg",
    })
    assert r.status_code == 200, r.text
    me = (await client.get("/account/me", headers=h)).json()
    assert me["full_name"] == "Ярослав К."
    assert me["phone"] == "+380671234567"
    assert me["avatar_url"].endswith("a.jpg")


@pytest.mark.asyncio
async def test_remove_avatar_keeps_other_fields(client, auth_headers):
    """Прибрати фото - передати null; імʼя й телефон не зачіпаються."""
    h = auth_headers("acc-2")
    await client.patch("/account/me", headers=h, json={"full_name": "Олена", "avatar_url": "https://x.supabase.co/a.jpg"})
    r = await client.patch("/account/me", headers=h, json={"avatar_url": None})
    assert r.json()["avatar_url"] is None
    assert r.json()["full_name"] == "Олена"


@pytest.mark.asyncio
async def test_bad_phone_rejected(client, auth_headers):
    """«+380 12» не зберігається тихо: за телефоном знаходяться записи."""
    r = await client.patch("/account/me", headers=auth_headers("acc-3"), json={"phone": "+380 12"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_email_cannot_be_set_here(client, auth_headers):
    """Пошта змінюється лише через Supabase Auth з підтвердженням."""
    h = auth_headers("acc-4")
    await client.patch("/account/me", headers=h, json={"email": "evil@example.com", "full_name": "Х"})
    assert (await client.get("/account/me", headers=h)).json()["email"] != "evil@example.com"
