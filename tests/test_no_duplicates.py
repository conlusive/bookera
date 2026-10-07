"""Один клієнт - одна картка, один запис - один раз: будь-який запис номера, одночасні запити, редагування, імпорт."""
import asyncio
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


def _slot(days, hour):
    return (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=days)).replace(hour=hour, minute=0, second=0, microsecond=0).isoformat()


async def _salon(client, h, name="Dup"):
    bid = (await client.post("/crm/businesses", json={"name": name, "city": "Львів"}, headers=h)).json()["id"]
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 30, "price": 300}, headers=h)).json()["id"]
    return bid, sid


async def _book(client, bid, sid, start, phone, email, session):
    return await client.post("/appointments", json={
        "business_id": bid, "service_id": sid, "start_time": start, "session_token": session,
        "client_name": "Клієнт", "client_phone": phone, "client_email": email,
    })


async def _count(bid):
    conn = await asyncpg.connect(DB)
    try:
        return await conn.fetchval("SELECT count(*) FROM clients WHERE business_id=$1", bid)
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_same_person_in_any_phone_format_is_one_card(client, auth_headers):
    h = auth_headers("nd-owner-1")
    bid, sid = await _salon(client, h)
    for i, phone in enumerate(["+380501112233", "0501112233", "+38 (050) 111-22-33", "380501112233"]):
        r = await _book(client, bid, sid, _slot(2, 9 + i), phone, None, f"nd{i}")
        assert r.status_code == 200, r.text
    assert await _count(bid) == 1, "чотири записи, чотири формати номера - одна картка"


@pytest.mark.asyncio
async def test_same_email_is_the_same_person(client, auth_headers):
    h = auth_headers("nd-owner-2")
    bid, sid = await _salon(client, h)
    await _book(client, bid, sid, _slot(2, 9), "+380671110001", "Anna@Test.com ", "e1")
    await _book(client, bid, sid, _slot(2, 11), "+380671110002", "anna@test.com", "e2")
    assert await _count(bid) == 1


@pytest.mark.asyncio
async def test_concurrent_bookings_do_not_create_two_cards(client, auth_headers):
    h = auth_headers("nd-owner-3")
    bid, sid = await _salon(client, h)
    results = await asyncio.gather(*[
        _book(client, bid, sid, _slot(2, 9 + i), "+380671119999", None, f"c{i}") for i in range(4)
    ])
    assert all(r.status_code == 200 for r in results), [r.text for r in results]
    assert await _count(bid) == 1, "одночасні записи однієї людини не плодять картки"


@pytest.mark.asyncio
async def test_double_submit_is_rejected(client, auth_headers):
    h = auth_headers("nd-owner-4")
    bid, sid = await _salon(client, h)
    start = _slot(2, 9)
    first = await _book(client, bid, sid, start, "+380671118888", None, "d1")
    second = await _book(client, bid, sid, start, "+380671118888", None, "d2")
    assert first.status_code == 200
    assert second.status_code == 409, "повторна відправка тієї ж форми другого запису не створює"


@pytest.mark.asyncio
async def test_manual_add_edit_and_import_do_not_duplicate(client, auth_headers):
    h = auth_headers("nd-owner-5")
    bid, sid = await _salon(client, h)
    a = await client.post("/crm/clients", json={"business_id": bid, "name": "Ірина", "phone": "+380501234567"}, headers=h)
    assert a.status_code == 201
    dup_phone = await client.post("/crm/clients", json={"business_id": bid, "name": "Ірина 2", "phone": "050 123 45 67"}, headers=h)
    assert dup_phone.status_code == 409
    b = await client.post("/crm/clients", json={"business_id": bid, "name": "Олег", "phone": "+380509998877", "email": "oleg@t.com"}, headers=h)
    assert b.status_code == 201
    dup_mail = await client.post("/crm/clients", json={"business_id": bid, "name": "Олег 2", "phone": "+380508887766", "email": "OLEG@t.com"}, headers=h)
    assert dup_mail.status_code == 409
    # редагування картки Олега на номер Ірини - теж дубль
    edit = await client.patch(f"/crm/clients/{b.json()['id']}", json={"phone": "0501234567"}, headers=h)
    assert edit.status_code == 409
    ok = await client.patch(f"/crm/clients/{b.json()['id']}", json={"name": "Олег Петренко"}, headers=h)
    assert ok.status_code == 200


@pytest.mark.asyncio
async def test_database_itself_refuses_a_second_card(client, auth_headers):
    h = auth_headers("nd-owner-6")
    bid, sid = await _salon(client, h)
    await client.post("/crm/clients", json={"business_id": bid, "name": "Перша", "phone": "+380501110000"}, headers=h)
    conn = await asyncpg.connect(DB)
    try:
        with pytest.raises(asyncpg.UniqueViolationError):
            await conn.execute("INSERT INTO clients (business_id, name, phone) VALUES ($1, 'Друга', '050 111 00 00')", bid)
    finally:
        await conn.close()
