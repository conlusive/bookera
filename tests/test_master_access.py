import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _make_master(user_id: str, business_id: int, name: str):
    """Майстер у закладі - роль 'master', не адміністратор."""
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "INSERT INTO users (id, email, full_name, role, business_id, is_active, "
            "provides_services, created_at) "
            "VALUES ($1, $2, $3, 'master', $4, true, true, now()) "
            "ON CONFLICT (id) DO UPDATE SET business_id = $4, role = 'master'",
            user_id, f"{user_id}@test.com", name, business_id,
        )
    finally:
        await conn.close()


async def _setup(client, headers):
    r = await client.post("/crm/businesses", json={"name": "Access Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={
        "business_id": business_id, "name": "Стрижка", "duration_minutes": 60, "price": 400,
    }, headers=headers)
    return business_id, r.json()["id"]


@pytest.mark.asyncio
async def test_master_sees_only_own_appointments(client, auth_headers):
    """
    Майстер відкривав календар і бачив ВЕСЬ заклад: чужі записи,
    імена й телефони чужих клієнтів.

    Обмеження було тільки на рівні вкладок у CRM - тобто його не було
    взагалі: приховане на фронтенді все одно приходить у відповіді.
    """
    owner = auth_headers("access-owner")
    business_id, service_id = await _setup(client, owner)

    await _make_master("master-a", business_id, "Майстер А")
    await _make_master("master-b", business_id, "Майстер Б")

    start = local_now().replace(microsecond=0) + timedelta(days=2)

    # Запис до майстра А
    r = await client.post("/crm/appointments", json={
        "business_id": business_id, "service_id": service_id,
        "start_time": start.isoformat(), "master_id": "master-a",
        "client_name": "Клієнт А", "client_phone": "+380671110001",
    }, headers=owner)
    assert r.status_code in (200, 201), r.text
    appt_a = r.json()["id"]

    # Запис до майстра Б
    r = await client.post("/crm/appointments", json={
        "business_id": business_id, "service_id": service_id,
        "start_time": (start + timedelta(hours=3)).isoformat(), "master_id": "master-b",
        "client_name": "Клієнт Б", "client_phone": "+380671110002",
    }, headers=owner)
    appt_b = r.json()["id"]

    # Майстер А бачить лише свій запис
    r = await client.get(f"/appointments/booked?business_id={business_id}",
                         headers=auth_headers("master-a"))
    assert r.status_code == 200, r.text
    ids = [a["id"] for a in r.json()]
    assert appt_a in ids, "свій запис має бути видно"
    assert appt_b not in ids, "чужий запис не має приходити у відповіді"

    # Власник бачить обидва
    r = await client.get(f"/appointments/booked?business_id={business_id}", headers=owner)
    ids = [a["id"] for a in r.json()]
    assert appt_a in ids and appt_b in ids, "власник веде заклад цілком"


@pytest.mark.asyncio
async def test_master_sees_only_own_clients(client, auth_headers):
    """
    База клієнтів - головний актив закладу. Майстер, який іде, не має
    вивантажити контакти всіх відвідувачів, зокрема тих, кого ніколи
    не бачив.
    """
    owner = auth_headers("clients-access-owner")
    business_id, service_id = await _setup(client, owner)

    await _make_master("cl-master-a", business_id, "Майстер А")
    await _make_master("cl-master-b", business_id, "Майстер Б")

    start = local_now().replace(microsecond=0) + timedelta(days=3)

    for master, phone, name in [("cl-master-a", "+380671112001", "Клієнт А"),
                                ("cl-master-b", "+380671112002", "Клієнт Б")]:
        r = await client.post("/crm/appointments", json={
            "business_id": business_id, "service_id": service_id,
            "start_time": start.isoformat(), "master_id": master,
            "client_name": name, "client_phone": phone,
        }, headers=owner)
        assert r.status_code in (200, 201), r.text
        start += timedelta(hours=3)

    r = await client.get(f"/crm/clients?business_id={business_id}",
                         headers=auth_headers("cl-master-a"))
    assert r.status_code == 200, r.text
    names = [c["name"] for c in r.json()]
    assert "Клієнт А" in names
    assert "Клієнт Б" not in names, "чужі клієнти не мають бути видні"

    # Власник бачить усіх
    r = await client.get(f"/crm/clients?business_id={business_id}", headers=owner)
    names = [c["name"] for c in r.json()]
    assert "Клієнт А" in names and "Клієнт Б" in names


@pytest.mark.asyncio
async def test_admin_is_not_limited(client, auth_headers):
    """
    Адміністратор веде заклад - обмеження на нього не поширюється.
    Інакше він не зміг би робити свою роботу.
    """
    owner = auth_headers("admin-access-owner")
    business_id, service_id = await _setup(client, owner)

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "INSERT INTO users (id, email, full_name, role, business_id, is_active, created_at) "
            "VALUES ($1, $2, $3, 'admin', $4, true, now()) "
            "ON CONFLICT (id) DO UPDATE SET business_id = $4, role = 'admin'",
            "the-admin", "admin@test.com", "Адміністратор", business_id,
        )
        await conn.close()
        conn = await asyncpg.connect(DB_URL_RAW)
        await conn.execute(
            "INSERT INTO users (id, email, full_name, role, business_id, is_active, created_at) "
            "VALUES ($1, $2, $3, 'master', $4, true, now()) ON CONFLICT (id) DO NOTHING",
            "some-master", "sm@test.com", "Майстер", business_id,
        )
    finally:
        await conn.close()

    start = local_now().replace(microsecond=0) + timedelta(days=4)
    r = await client.post("/crm/appointments", json={
        "business_id": business_id, "service_id": service_id,
        "start_time": start.isoformat(), "master_id": "some-master",
        "client_name": "Чийсь клієнт", "client_phone": "+380671113001",
    }, headers=owner)
    appt_id = r.json()["id"]

    r = await client.get(f"/appointments/booked?business_id={business_id}",
                         headers=auth_headers("the-admin"))
    assert appt_id in [a["id"] for a in r.json()], \
        "адміністратор має бачити чужі записи"


@pytest.mark.asyncio
async def test_hidden_master_flag_reaches_client(client, auth_headers):
    """
    Наскрізна перевірка перемикача «Показувати на сторінці закладу».

    Ланцюжок довгий - модель, схема, ендпоінт, тип, фільтр на сторінці -
    і рветься тихо: поле зберігається, а блок команди показує всіх.
    Саме так і сталось: усе було на місці, крім фільтра.
    """
    owner = auth_headers("visibility-owner")
    business_id, _ = await _setup(client, owner)

    await _make_master("visible-master", business_id, "Видимий")
    await _make_master("hidden-master", business_id, "Прихований")

    r = await client.patch("/crm/staff/hidden-master", json={
        "show_in_storefront": False,
    }, headers=owner)
    assert r.status_code == 200, r.text

    r = await client.get(f"/crm/businesses/{business_id}/masters")
    assert r.status_code == 200, r.text
    masters = {m["full_name"]: m for m in r.json()}

    # Обидва в списку - бо він живить і вибір при бронюванні
    assert "Видимий" in masters and "Прихований" in masters, \
        "прихований майстер має лишатись доступним для запису"

    # Але позначені по-різному - за цим фільтрує сторінка
    assert masters["Видимий"]["show_in_storefront"] is not False
    assert masters["Прихований"]["show_in_storefront"] is False
