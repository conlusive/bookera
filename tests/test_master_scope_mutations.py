import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _staff(user_id: str, business_id: int, role: str):
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute(
            "INSERT INTO users (id, email, full_name, role, business_id, is_active, provides_services, created_at) "
            "VALUES ($1, $2, $1, $4, $3, true, true, now()) ON CONFLICT (id) DO UPDATE SET business_id=$3, role=$4",
            user_id, f"{user_id}@test.com", business_id, role)
        await conn.execute(
            "INSERT INTO staff_memberships (user_id, business_id, role, is_active) "
            "VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING", user_id, business_id, role)
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_master_cannot_change_colleagues_appointments(client, auth_headers):
    """
    Майстер бачив у списку лише свої записи, але знаючи id міг скасувати, завершити (комісія й
    виплата), перенести чи видалити запис колеги. Тепер - лише свої; адміністратор - будь-які.
    """
    owner = auth_headers("scope-owner")
    business_id = (await client.post("/crm/businesses", json={"name": "Scope", "city": "Львів"}, headers=owner)).json()["id"]
    service_id = (await client.post("/services", json={"business_id": business_id, "name": "Стрижка", "duration_minutes": 60, "price": 400}, headers=owner)).json()["id"]
    await _staff("scope-a", business_id, "master")
    await _staff("scope-b", business_id, "master")
    await _staff("scope-admin", business_id, "admin")

    base = local_now().replace(microsecond=0, second=0, minute=0) + timedelta(days=2)

    async def book(master: str, hours: int):
        r = await client.post("/crm/appointments", json={
            "business_id": business_id, "service_id": service_id, "master_id": master,
            "start_time": (base + timedelta(hours=hours)).isoformat(),
            "client_name": f"Клієнт {master}", "client_phone": f"+38067111{hours:04d}",
        }, headers=owner)
        assert r.status_code == 201, r.text
        return r.json()["id"]

    a_id, b_id, b2_id, b3_id = await book("scope-a", 1), await book("scope-b", 3), await book("scope-b", 5), await book("scope-b", 7)
    a = auth_headers("scope-a", "master")

    # чужий запис: статус (обидва маршрути), перенесення, видалення - заборонено
    assert (await client.patch(f"/crm/appointments/{b_id}/status", json={"status": "cancelled"}, headers=a)).status_code == 403
    assert (await client.patch(f"/appointments/{b_id}/status", json={"status": "cancelled"}, headers=a)).status_code == 403
    new_start = (base + timedelta(hours=9)).isoformat()
    assert (await client.patch(f"/crm/appointments/{b_id}/reschedule", json={"start_time": new_start}, headers=a)).status_code == 403
    assert (await client.delete(f"/crm/appointments/{b_id}", headers=a)).status_code == 403

    # записати клієнта на колегу чи на весь заклад не можна
    other = {"business_id": business_id, "service_id": service_id, "start_time": (base + timedelta(hours=11)).isoformat(), "client_name": "X", "client_phone": "+380671119999"}
    assert (await client.post("/crm/appointments", json={**other, "master_id": "scope-b"}, headers=a)).status_code == 403
    assert (await client.post("/crm/appointments", json=other, headers=a)).status_code == 403

    # а у свій графік - можна, і свої записи міняти - теж
    assert (await client.post("/crm/appointments", json={**other, "master_id": "scope-a"}, headers=a)).status_code == 201
    assert (await client.patch(f"/crm/appointments/{a_id}/status", json={"status": "completed"}, headers=a)).status_code == 200
    assert (await client.patch(f"/crm/appointments/{a_id}/reschedule", json={"start_time": (base + timedelta(hours=13)).isoformat()}, headers=a)).status_code == 200

    # адміністратор веде весь заклад
    admin = auth_headers("scope-admin", "admin")
    assert (await client.patch(f"/crm/appointments/{b2_id}/status", json={"status": "cancelled"}, headers=admin)).status_code == 200
    assert (await client.delete(f"/crm/appointments/{b3_id}", headers=admin)).status_code == 200

    # колега свій запис досі має
    assert (await client.patch(f"/crm/appointments/{b_id}/status", json={"status": "confirmed"}, headers=auth_headers("scope-b", "master"))).status_code == 200
