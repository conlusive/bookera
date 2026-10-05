import asyncpg
import pytest

from tests.conftest import make_token


def _as(user_id: str, email: str, role: str = "master"):
    """Токен людини з конкретною поштою: запрошення приймає лише власник тієї пошти."""
    return {"Authorization": f"Bearer {make_token(user_id, role, email=email)}"}

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _salon(client, h):
    return (await client.post("/crm/businesses", json={"name": "Invite Salon", "city": "Львів"}, headers=h)).json()["id"]


@pytest.mark.asyncio
async def test_full_invite_flow(client, auth_headers):
    """
    Власник запрошує -> майстер бачить, куди кличуть -> входить -> приймає
    -> зʼявляється в команді. Раніше ламалось на кожному кроці.
    """
    owner = auth_headers("inv-owner")
    bid = await _salon(client, owner)

    r = await client.post(f"/crm/businesses/{bid}/invites", json={"email": "Master@Example.com", "role": "master"}, headers=owner)
    assert r.status_code == 201, r.text
    inv = r.json()
    assert inv["invite_url"] and "/invite?token=" in inv["invite_url"], "посилання, яке можна скопіювати"
    token = inv["invite_url"].split("token=")[1]

    info = (await client.get(f"/public/invites/{token}")).json()
    assert info["business_name"] == "Invite Salon" and info["status"] == "pending"

    master = _as("inv-master", "master@example.com")
    r = await client.post("/public/invites/accept", json={"token": token}, headers=master)
    assert r.status_code == 200, r.text

    staff = (await client.get(f"/crm/businesses/{bid}/staff", headers=owner)).json()
    assert any(s["id"] == "inv-master" for s in staff), "майстер у команді"
    assert (await client.get(f"/crm/businesses/{bid}/invites", headers=owner)).json() == [], "у «очікують» - порожньо"


@pytest.mark.asyncio
async def test_second_invite_same_email_reuses(client, auth_headers):
    """Повторне запрошення - той самий запис із новим строком, а не дублікат."""
    owner = auth_headers("inv-owner-2")
    bid = await _salon(client, owner)
    a = (await client.post(f"/crm/businesses/{bid}/invites", json={"email": "x@example.com"}, headers=owner)).json()
    b = (await client.post(f"/crm/businesses/{bid}/invites", json={"email": "X@example.com"}, headers=owner)).json()
    assert a["id"] == b["id"]
    assert len((await client.get(f"/crm/businesses/{bid}/invites", headers=owner)).json()) == 1


@pytest.mark.asyncio
async def test_cancelled_invite_cannot_be_accepted(client, auth_headers):
    owner = auth_headers("inv-owner-3")
    bid = await _salon(client, owner)
    inv = (await client.post(f"/crm/businesses/{bid}/invites", json={"email": "c@example.com"}, headers=owner)).json()
    assert (await client.delete(f"/crm/businesses/{bid}/invites/{inv['id']}", headers=owner)).status_code == 204
    token = inv["invite_url"].split("token=")[1]
    r = await client.post("/public/invites/accept", json={"token": token}, headers=_as("inv-late", "c@example.com"))
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_cannot_invite_as_owner_role(client, auth_headers):
    owner = auth_headers("inv-owner-4")
    bid = await _salon(client, owner)
    r = await client.post(f"/crm/businesses/{bid}/invites", json={"email": "o@example.com", "role": "business_owner"}, headers=owner)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_cannot_invite_existing_member(client, auth_headers):
    owner = auth_headers("inv-owner-5")
    bid = await _salon(client, owner)
    inv = (await client.post(f"/crm/businesses/{bid}/invites", json={"email": "m5@example.com"}, headers=owner)).json()
    token = inv["invite_url"].split("token=")[1]
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("INSERT INTO users (id, email, role, is_active, created_at) VALUES ('inv-m5','m5@example.com','client',true,now()) ON CONFLICT DO NOTHING")
    finally:
        await conn.close()
    await client.post("/public/invites/accept", json={"token": token}, headers=_as("inv-m5", "m5@example.com"))
    r = await client.post(f"/crm/businesses/{bid}/invites", json={"email": "m5@example.com"}, headers=owner)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_stranger_cannot_list_invites(client, auth_headers):
    bid = await _salon(client, auth_headers("inv-owner-6"))
    r = await client.get(f"/crm/businesses/{bid}/invites", headers=auth_headers("inv-stranger"))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_validator_error_is_422_with_message(client, auth_headers):
    """
    Помилка власного валідатора - 422 зі зрозумілим текстом, а не 500.
    Раніше обробник помилок сам падав, не вміючи перетворити виняток на JSON.
    """
    owner = auth_headers("inv-owner-7")
    bid = await _salon(client, owner)
    r = await client.post(f"/crm/businesses/{bid}/invites", json={"email": "o@example.com", "role": "boss"}, headers=owner)
    assert r.status_code == 422
    assert "master або admin" in r.json()["detail"]


@pytest.mark.asyncio
async def test_invite_cannot_be_accepted_with_another_email(client, auth_headers):
    """Посилання могло витекти чи бути переслане: роль отримує лише власник тієї пошти."""
    owner = auth_headers("inv-owner-6")
    bid = await _salon(client, owner)
    inv = (await client.post(f"/crm/businesses/{bid}/invites", json={"email": "right@example.com"}, headers=owner)).json()
    token = inv["invite_url"].split("token=")[1]

    r = await client.post("/public/invites/accept", json={"token": token}, headers=_as("inv-intruder", "wrong@example.com"))
    assert r.status_code == 403, r.text
    staff = (await client.get(f"/crm/businesses/{bid}/staff", headers=owner)).json()
    assert all(s["id"] != "inv-intruder" for s in staff)

    # а справжній адресат - приймає (регістр пошти не важливий)
    r = await client.post("/public/invites/accept", json={"token": token}, headers=_as("inv-right", "RIGHT@example.com"))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_only_owner_can_invite_an_admin(client, auth_headers):
    owner = auth_headers("inv-owner-7")
    bid = await _salon(client, owner)
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("INSERT INTO users (id,email,full_name,role,business_id,is_active,created_at) VALUES ('inv-adm','adm7@example.com','Adm','admin',$1,true,now()) ON CONFLICT (id) DO UPDATE SET business_id=$1, role='admin'", bid)
        await conn.execute("INSERT INTO staff_memberships (user_id,business_id,role,is_active) VALUES ('inv-adm',$1,'admin',true) ON CONFLICT DO NOTHING", bid)
    finally:
        await conn.close()
    admin = auth_headers("inv-adm", "admin")
    # адміністратор: майстра - можна, адміністратора - ні
    assert (await client.post(f"/crm/businesses/{bid}/invites", json={"email": "newm@example.com", "role": "master"}, headers=admin)).status_code == 201
    assert (await client.post(f"/crm/businesses/{bid}/invites", json={"email": "newa@example.com", "role": "admin"}, headers=admin)).status_code == 403
    # власник - може
    assert (await client.post(f"/crm/businesses/{bid}/invites", json={"email": "newa@example.com", "role": "admin"}, headers=owner)).status_code == 201


@pytest.mark.asyncio
async def test_invite_email_escapes_business_name_and_is_capped(client, auth_headers, monkeypatch):
    """Назва закладу вводить людина: у листі від імені платформи вона не може бути HTML."""
    sent = []
    import app.api.crm.staff as staff_api
    monkeypatch.setattr(staff_api, "send_email_sync", lambda **kw: sent.append(kw))

    owner = auth_headers("inv-owner-8")
    bid = (await client.post("/crm/businesses", json={"name": '<a href="https://evil.example">Підтвердіть пароль</a>', "city": "Львів"}, headers=owner)).json()["id"]
    r = await client.post(f"/crm/businesses/{bid}/invites", json={"email": "victim@example.com"}, headers=owner)
    assert r.status_code == 201, r.text
    html = sent[0]["html_content"]
    assert '<a href="https://evil.example"' not in html
    assert "&lt;a href=" in html

    # ліміт: 30 запрошень на добу з одного закладу
    for i in range(29):
        assert (await client.post(f"/crm/businesses/{bid}/invites", json={"email": f"u{i}@example.com"}, headers=owner)).status_code == 201
    r = await client.post(f"/crm/businesses/{bid}/invites", json={"email": "extra@example.com"}, headers=owner)
    assert r.status_code == 429, r.text
