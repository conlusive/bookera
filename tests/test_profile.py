import asyncpg
import pytest
from datetime import datetime, timedelta, timezone

from app.core.time_utils import local_now

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _setup(client, headers, name="Profile Salon"):
    r = await client.post("/crm/businesses", json={"name": name, "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={
        "business_id": business_id, "name": "Стрижка", "duration_minutes": 60, "price": 400,
    }, headers=headers)
    return business_id, r.json()["id"]


@pytest.mark.asyncio
async def test_profile_shows_own_appointments(client, auth_headers):
    """
    Записи в профілі не показувались НІКОЛИ.

    Сторінка читала базу напряму й шукала за `user_id.eq.{id}` або
    `client_id.eq.{id}`. Обидві умови хибні: поля user_id в записах
    немає взагалі, а client_id посилається на клієнта ЗАКЛАДУ - це
    інший ідентифікатор, ніж обліковий запис.

    Звʼязок дає пошта: людина записується як гість і вводить контакти,
    жодного звʼязку з акаунтом при цьому не виникає.
    """
    owner = auth_headers("profile-owner")
    business_id, service_id = await _setup(client, owner)

    # Обліковий запис клієнта
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "INSERT INTO users (id, email, role, is_active, created_at) "
            "VALUES ($1, $2, 'client', true, now()) ON CONFLICT (id) DO UPDATE SET email = $2",
            "profile-client", "client@test.com",
        )
    finally:
        await conn.close()

    start = local_now().replace(microsecond=0) + timedelta(days=3)
    r = await client.post("/appointments", json={
        "business_id": business_id, "service_id": service_id,
        "start_time": start.isoformat(),
        "client_name": "Клієнт", "client_phone": "+380671112233",
        "client_email": "client@test.com",
    })
    assert r.status_code == 200, r.text
    appointment_id = r.json()["id"]

    r = await client.get("/appointments/my", headers=auth_headers("profile-client"))
    assert r.status_code == 200, r.text
    ids = [a["id"] for a in r.json()]
    assert appointment_id in ids, "запис має зʼявитись у профілі"

    # Назви потрібні: без них профіль показує дати без натяку, куди
    # саме людина ходила
    found = next(a for a in r.json() if a["id"] == appointment_id)
    assert found["business_name"] == "Profile Salon"
    assert found["service_name"] == "Стрижка"


@pytest.mark.asyncio
async def test_profile_does_not_show_foreign_appointments(client, auth_headers):
    """Чужі записи в профіль не потрапляють."""
    owner = auth_headers("foreign-profile-owner")
    business_id, service_id = await _setup(client, owner, "Foreign Profile Salon")

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "INSERT INTO users (id, email, role, is_active, created_at) "
            "VALUES ($1, $2, 'client', true, now()) ON CONFLICT (id) DO UPDATE SET email = $2",
            "nosy-client", "nosy@test.com",
        )
    finally:
        await conn.close()

    start = local_now().replace(microsecond=0) + timedelta(days=4)
    r = await client.post("/appointments", json={
        "business_id": business_id, "service_id": service_id,
        "start_time": start.isoformat(),
        "client_name": "Хтось інший", "client_phone": "+380509998877",
        "client_email": "someone-else@test.com",
    })
    assert r.status_code == 200, r.text

    r = await client.get("/appointments/my", headers=auth_headers("nosy-client"))
    assert r.status_code == 200, r.text
    assert r.json() == [], "чужі записи не мають бути видні"


@pytest.mark.asyncio
async def test_profile_finds_appointments_by_phone(client, auth_headers):
    """
    Пошук і за телефоном: людина могла записатись, вказавши лише номер.

    Порівнюємо за останніми 9 цифрами - той самий номер зустрічається
    як +380671112233, 0671112233 і 380671112233.
    """
    owner = auth_headers("phone-profile-owner")
    business_id, service_id = await _setup(client, owner, "Phone Profile Salon")

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "INSERT INTO users (id, email, phone, role, is_active, created_at) "
            "VALUES ($1, $2, $3, 'client', true, now()) "
            "ON CONFLICT (id) DO UPDATE SET phone = $3",
            "phone-client", "phone-client@test.com", "0671234567",
        )
    finally:
        await conn.close()

    start = local_now().replace(microsecond=0) + timedelta(days=5)
    r = await client.post("/appointments", json={
        "business_id": business_id, "service_id": service_id,
        "start_time": start.isoformat(),
        "client_name": "За номером",
        # Інший формат того самого номера
        "client_phone": "+380671234567",
    })
    assert r.status_code == 200, r.text
    appointment_id = r.json()["id"]

    r = await client.get("/appointments/my", headers=auth_headers("phone-client"))
    assert appointment_id in [a["id"] for a in r.json()], \
        "номер у іншому форматі має знаходитись"
