import asyncpg
import pytest

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _master(user_id: str, business_id: int, permissions=None):
    import json
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute(
            "INSERT INTO users (id, email, full_name, role, business_id, is_active, created_at) "
            "VALUES ($1, $2, $1, 'master', $3, true, now()) ON CONFLICT (id) DO UPDATE SET business_id=$3, role='master'",
            user_id, f"{user_id}@test.com", business_id)
        await conn.execute(
            "INSERT INTO staff_memberships (user_id, business_id, role, is_active, permissions) "
            "VALUES ($1, $2, 'master', true, $3::jsonb) ON CONFLICT (user_id, business_id) DO UPDATE SET permissions=$3::jsonb",
            user_id, business_id, json.dumps(permissions) if permissions else None)
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_inventory_list_needs_inventory_or_services_section(client, auth_headers):
    owner = auth_headers("inv-owner")
    business_id = (await client.post("/crm/businesses", json={"name": "Inv", "city": "Львів"}, headers=owner)).json()["id"]
    r = await client.post("/crm/inventory", json={"business_id": business_id, "name": "Фарба", "quantity": 5, "unit": "шт", "cost_per_unit": 120}, headers=owner)
    assert r.status_code == 201, r.text

    await _master("inv-plain", business_id)
    await _master("inv-stock", business_id, {"inventory": True})
    await _master("inv-services", business_id, {"services": True})

    assert (await client.get(f"/crm/inventory?business_id={business_id}", headers=owner)).status_code == 200
    # майстер без доступів склад не бачить
    assert (await client.get(f"/crm/inventory?business_id={business_id}", headers=auth_headers("inv-plain", "master"))).status_code == 403
    # із розділом «Склад» або «Послуги» - бачить
    assert (await client.get(f"/crm/inventory?business_id={business_id}", headers=auth_headers("inv-stock", "master"))).status_code == 200
    assert (await client.get(f"/crm/inventory?business_id={business_id}", headers=auth_headers("inv-services", "master"))).status_code == 200
