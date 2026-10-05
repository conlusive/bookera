import asyncpg
import pytest

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _make_staff(user_id: str, business_id: int, role: str):
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute(
            "INSERT INTO users (id, email, full_name, role, business_id, is_active, created_at) "
            "VALUES ($1, $2, $3, $4, $5, true, now()) ON CONFLICT (id) DO UPDATE SET business_id=$5, role=$4",
            user_id, f"{user_id}@test.com", user_id, role, business_id)
        await conn.execute(
            "INSERT INTO staff_memberships (user_id, business_id, role, is_active) "
            "VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING", user_id, business_id, role)
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_admin_cannot_remove_the_owner(client, auth_headers):
    owner = auth_headers("prot-owner")
    business_id = (await client.post("/crm/businesses", json={"name": "Protected", "city": "Львів"}, headers=owner)).json()["id"]
    await _make_staff("prot-admin", business_id, "admin")
    await _make_staff("prot-master", business_id, "master")
    admin = auth_headers("prot-admin", "admin")

    # власника адміністратор звільнити не може
    r = await client.delete(f"/crm/staff/prot-owner?business_id={business_id}", headers=admin)
    assert r.status_code == 403, r.text
    ids = {s["id"] for s in (await client.get(f"/crm/businesses/{business_id}/staff", headers=owner)).json()}
    assert "prot-owner" in ids, "власник лишився в команді"

    # а звичайного майстра - може, як і раніше
    r = await client.delete(f"/crm/staff/prot-master?business_id={business_id}", headers=admin)
    assert r.status_code == 204, r.text
