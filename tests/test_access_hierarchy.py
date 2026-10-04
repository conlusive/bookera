import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _team(client, auth_headers, tag, with_admin=True):
    owner = auth_headers(f"ah-owner-{tag}")
    bid = (await client.post("/crm/businesses", json={"name": "Hier", "city": "Львів"}, headers=owner)).json()["id"]
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 500}, headers=owner)).json()["id"]
    conn = await asyncpg.connect(DB)
    people = {"master": f"ah-m-{tag}"}
    if with_admin:
        people["admin"] = f"ah-a-{tag}"
    try:
        for role, uid in people.items():
            await conn.execute("INSERT INTO users (id, email, full_name, role, is_active, created_at, business_id) VALUES ($1,$2,$3,$4,true,now(),$5)",
                               uid, f"{uid}@example.com", "Олена" if role == "master" else "Ірина", role, bid)
            await conn.execute("INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at) VALUES ($1,$2,$3,true,now())", uid, bid, role)
    finally:
        await conn.close()
    h = {k: auth_headers(v, k) for k, v in people.items()}
    return bid, sid, owner, h, people


# ---------------------------------------------------------------- доступи

@pytest.mark.asyncio
async def test_owner_opens_and_closes_services_for_master(client, auth_headers):
    bid, sid, owner, h, p = await _team(client, auth_headers, "svc")
    assert (await client.patch(f"/services/{sid}", json={"price": 550}, headers=h["master"])).status_code == 403

    r = await client.put(f"/crm/businesses/{bid}/staff/{p['master']}/access", json={"sections": {"services": True}}, headers=owner)
    assert r.status_code == 200 and r.json()["sections"]["services"] is True
    assert (await client.patch(f"/services/{sid}", json={"price": 550}, headers=h["master"])).status_code == 200

    await client.put(f"/crm/businesses/{bid}/staff/{p['master']}/access", json={"sections": {"services": False}}, headers=owner)
    assert (await client.patch(f"/services/{sid}", json={"price": 600}, headers=h["master"])).status_code == 403


@pytest.mark.asyncio
async def test_owner_closes_analytics_for_admin(client, auth_headers):
    bid, sid, owner, h, p = await _team(client, auth_headers, "ana")
    assert (await client.get(f"/crm/businesses/{bid}/stats", headers=h["admin"])).status_code == 200
    await client.put(f"/crm/businesses/{bid}/staff/{p['admin']}/access", json={"sections": {"analytics": False}}, headers=owner)
    assert (await client.get(f"/crm/businesses/{bid}/stats", headers=h["admin"])).status_code == 403
    me = (await client.get(f"/crm/businesses/{bid}/me/access", headers=h["admin"])).json()
    assert me["role"] == "admin" and me["sections"]["analytics"] is False and me["sections"]["services"] is True


@pytest.mark.asyncio
async def test_promotion_and_only_owner_grants(client, auth_headers):
    bid, sid, owner, h, p = await _team(client, auth_headers, "pro")
    # адміністратор роздавати доступи не може
    assert (await client.put(f"/crm/businesses/{bid}/staff/{p['master']}/access", json={"role": "admin"}, headers=h["admin"])).status_code == 403
    # власник підвищує майстра
    r = await client.put(f"/crm/businesses/{bid}/staff/{p['master']}/access", json={"role": "admin"}, headers=owner)
    assert r.json()["role"] == "admin" and all(r.json()["sections"].values()), "адміністратор - типові доступи"
    assert (await client.get(f"/crm/businesses/{bid}/staff-requests", headers=h["master"])).status_code == 200, "тепер має права адміністратора"


@pytest.mark.asyncio
async def test_all_clients_section(client, auth_headers):
    bid, sid, owner, h, p = await _team(client, auth_headers, "cli")
    await client.post("/crm/clients", json={"business_id": bid, "name": "Чужий клієнт", "phone": "+380501234567"}, headers=owner)
    before = (await client.get("/crm/clients", params={"business_id": bid}, headers=h["master"])).json()
    assert before == [], "без доступу - лише свої"
    await client.put(f"/crm/businesses/{bid}/staff/{p['master']}/access", json={"sections": {"clients": True}}, headers=owner)
    after = (await client.get("/crm/clients", params={"business_id": bid}, headers=h["master"])).json()
    assert [c["name"] for c in after] == ["Чужий клієнт"]


# ---------------------------------------------------------------- ієрархія запитів

@pytest.mark.asyncio
async def test_master_request_goes_to_admin_then_escalates(client, auth_headers):
    bid, sid, owner, h, p = await _team(client, auth_headers, "esc")
    d = (local_now() + timedelta(days=3)).date().isoformat()
    rid = (await client.post("/work/me/requests", json={"business_id": bid, "kind": "time_off", "date_from": d, "date_to": d}, headers=h["master"])).json()["id"]

    admin_inbox = (await client.get(f"/crm/businesses/{bid}/staff-requests", headers=h["admin"])).json()
    assert [x["id"] for x in admin_inbox] == [rid] and admin_inbox[0]["stage"] == "admin"

    r = await client.post(f"/crm/businesses/{bid}/staff-requests/{rid}/escalate", json={"note": "Того дня багато записів"}, headers=h["admin"])
    assert r.status_code == 200 and r.json()["stage"] == "owner"
    assert (await client.get(f"/crm/businesses/{bid}/staff-requests", headers=h["admin"])).json() == [], "у адміністратора зник"
    # адміністратор вже не може вирішити
    assert (await client.post(f"/crm/businesses/{bid}/staff-requests/{rid}/decide", json={"approve": True}, headers=h["admin"])).status_code == 403
    owner_inbox = (await client.get(f"/crm/businesses/{bid}/staff-requests", headers=owner)).json()
    assert owner_inbox[0]["escalation_note"] == "Того дня багато записів"
    assert (await client.post(f"/crm/businesses/{bid}/staff-requests/{rid}/decide", json={"approve": False}, headers=owner)).status_code == 200


@pytest.mark.asyncio
async def test_admin_decides_master_request_himself(client, auth_headers):
    bid, sid, owner, h, p = await _team(client, auth_headers, "adm")
    week = [{"active": True, "start": "10:00", "end": "18:00"} for _ in range(7)]
    rid = (await client.post("/work/me/requests", json={"business_id": bid, "kind": "schedule", "shifts": week}, headers=h["master"])).json()["id"]
    r = await client.post(f"/crm/businesses/{bid}/staff-requests/{rid}/decide", json={"approve": True}, headers=h["admin"])
    assert r.status_code == 200 and r.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_no_admin_goes_straight_to_owner(client, auth_headers):
    bid, sid, owner, h, p = await _team(client, auth_headers, "solo", with_admin=False)
    d = (local_now() + timedelta(days=3)).date().isoformat()
    r = (await client.post("/work/me/requests", json={"business_id": bid, "kind": "time_off", "date_from": d, "date_to": d}, headers=h["master"])).json()
    assert r["stage"] == "owner"


@pytest.mark.asyncio
async def test_access_request_only_owner_and_applies(client, auth_headers):
    bid, sid, owner, h, p = await _team(client, auth_headers, "acc")
    r = (await client.post("/work/me/requests", json={"business_id": bid, "kind": "access", "sections": ["services"], "comment": "Хочу сама вести ціни"}, headers=h["master"])).json()
    assert r["stage"] == "owner", "доступи роздає лише власник"
    assert (await client.get(f"/crm/businesses/{bid}/staff-requests", headers=h["admin"])).json() == []
    await client.post(f"/crm/businesses/{bid}/staff-requests/{r['id']}/decide", json={"approve": True}, headers=owner)
    assert (await client.patch(f"/services/{sid}", json={"price": 700}, headers=h["master"])).status_code == 200


@pytest.mark.asyncio
async def test_admin_own_request_goes_to_owner(client, auth_headers):
    bid, sid, owner, h, p = await _team(client, auth_headers, "aown")
    d = (local_now() + timedelta(days=3)).date().isoformat()
    r = (await client.post("/work/me/requests", json={"business_id": bid, "kind": "time_off", "date_from": d, "date_to": d}, headers=h["admin"])).json()
    assert r["stage"] == "owner"


# ---------------------------------------------------------------- журнал

@pytest.mark.asyncio
async def test_audit_log_and_visibility(client, auth_headers):
    bid, sid, owner, h, p = await _team(client, auth_headers, "aud")
    await client.patch(f"/services/{sid}", json={"price": 650}, headers=owner)        # дія власника
    await client.put(f"/crm/businesses/{bid}/staff/{p['master']}/access", json={"sections": {"services": True}}, headers=owner)
    await client.patch(f"/services/{sid}", json={"price": 700}, headers=h["master"])  # дія майстра

    owner_log = (await client.get(f"/crm/businesses/{bid}/audit", headers=owner)).json()["items"]
    summaries = [e["summary"] for e in owner_log]
    assert any("Стрижка" in s and "700" in s for s in summaries)
    assert any("Доступ для Олена" in s and "Послуги й ціни: відкрито" in s for s in summaries)

    admin_log = (await client.get(f"/crm/businesses/{bid}/audit", headers=h["admin"])).json()["items"]
    assert all(e["actor_role"] != "owner" for e in admin_log), "адміністратор не бачить дій власника"
    assert any(e["actor_role"] == "master" for e in admin_log)
    assert (await client.get(f"/crm/businesses/{bid}/audit", headers=h["master"])).status_code == 403


@pytest.mark.asyncio
async def test_admin_cannot_change_role_via_staff_edit(client, auth_headers):
    """Старий шлях зміни ролі (редагування працівника) - теж лише власник."""
    bid, sid, owner, h, p = await _team(client, auth_headers, "old")
    assert (await client.patch(f"/crm/staff/{p['admin']}?business_id={bid}", json={"role": "admin"}, headers=h["admin"])).status_code == 403
    assert (await client.patch(f"/crm/staff/{p['master']}?business_id={bid}", json={"role": "admin"}, headers=h["admin"])).status_code == 403
    assert (await client.patch(f"/crm/staff/{p['master']}?business_id={bid}", json={"role": "admin"}, headers=owner)).status_code == 200
    me = (await client.get(f"/crm/businesses/{bid}/me/access", headers=h["master"])).json()
    assert me["role"] == "admin", "членство оновлено разом із роллю"
