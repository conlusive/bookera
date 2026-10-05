import asyncpg
import pytest

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


@pytest.mark.asyncio
async def test_transfer_ownership_swaps_roles_in_team_list(client, auth_headers):
    """
    Після передачі прав список команди має показувати нового власника власником, а
    колишнього - адміністратором. Раніше змінювалась лише роль у профілі, а роль у
    членстві закладу (її читає список команди) лишалась старою.
    """
    owner = auth_headers("swap-owner")
    business_id = (await client.post("/crm/businesses", json={"name": "Swap Salon", "city": "Львів"}, headers=owner)).json()["id"]

    conn = await asyncpg.connect(DB)
    try:
        await conn.execute(
            "INSERT INTO users (id, email, full_name, role, business_id, is_active, created_at) "
            "VALUES ('swap-admin', 'swap-admin@test.com', 'Swap Admin', 'admin', $1, true, now()) "
            "ON CONFLICT (id) DO UPDATE SET business_id=$1, role='admin'", business_id)
        await conn.execute(
            "INSERT INTO staff_memberships (user_id, business_id, role, is_active) "
            "VALUES ('swap-admin', $1, 'admin', true) ON CONFLICT DO NOTHING", business_id)
    finally:
        await conn.close()

    r = await client.post(f"/crm/businesses/{business_id}/transfer-ownership", json={"new_owner_user_id": "swap-admin"}, headers=owner)
    assert r.status_code == 200, r.text

    staff = (await client.get(f"/crm/businesses/{business_id}/staff", headers=auth_headers("swap-admin"))).json()
    roles = {s["id"]: s["role"] for s in staff}
    assert roles["swap-admin"] == "business_owner", roles
    assert roles["swap-owner"] == "admin", roles
