import asyncpg
import pytest
from datetime import datetime, timedelta, timezone

from app.core.time_utils import local_now

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _setup(client, headers, name="Block Salon"):
    r = await client.post("/crm/businesses", json={"name": name, "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.post("/services", json={
        "business_id": business_id, "name": "Стрижка", "duration_minutes": 60, "price": 400,
    }, headers=headers)
    service_id = r.json()["id"]

    await client.put(f"/crm/businesses/{business_id}/hours", json=[
        {"weekday": d, "is_closed": False, "is_open": True,
         "open_time": "09:00", "close_time": "20:00"} for d in range(7)
    ], headers=headers)

    return business_id, service_id


@pytest.mark.asyncio
async def test_block_survives_reload(client, auth_headers):
    """
    ГОЛОВНИЙ БАГ: заклад блокував час, бачив його на екрані,
    перезавантажував сторінку - і блокування зникало назавжди.

    Причина: видача вимагала expires_at > now. Але expires_at - це
    поле тимчасового замка слота на 15 хвилин; постійні блокування
    від закладу його не мають, і NULL > now завжди хибне.
    """
    headers = auth_headers("block-reload-owner")
    business_id, _ = await _setup(client, headers, "Block Reload Salon")

    start = local_now().replace(microsecond=0) + timedelta(days=2)
    r = await client.post("/crm/appointments", json={
        "business_id": business_id,
        "start_time": start.isoformat(),
        "duration_minutes": 60,
        "is_block": True,
        "client_name": "Обід",
    }, headers=headers)
    assert r.status_code in (200, 201), r.text
    blocked_id = r.json()["id"]

    # Те, що бачить календар після перезавантаження
    r = await client.get(f"/appointments/booked?business_id={business_id}", headers=headers)
    assert r.status_code == 200, r.text
    ids = [a["id"] for a in r.json()]
    assert blocked_id in ids, "блокування має лишатись у календарі"

    found = next(a for a in r.json() if a["id"] == blocked_id)
    assert found["status"] == "blocked"


@pytest.mark.asyncio
async def test_client_cannot_book_blocked_time(client, auth_headers):
    """
    Та сама помилка в перевірці слотів дозволяла клієнту записатись
    на час, який заклад заблокував: обід майстра був вільним для
    онлайн-запису.
    """
    headers = auth_headers("block-slot-owner")
    business_id, service_id = await _setup(client, headers, "Block Slot Salon")

    target = local_now().date() + timedelta(days=3)
    blocked_at = datetime.combine(target, datetime.min.time()).replace(hour=13)

    r = await client.post("/crm/appointments", json={
        "business_id": business_id,
        "start_time": blocked_at.isoformat(),
        "duration_minutes": 60,
        "is_block": True,
        "client_name": "Обід",
    }, headers=headers)
    assert r.status_code in (200, 201), r.text

    r = await client.get(
        f"/appointments/available-slots?business_id={business_id}"
        f"&service_id={service_id}&target_date={target.isoformat()}"
    )
    assert r.status_code == 200, r.text

    slot = next((s for s in r.json()["slots"] if s["time"] == "13:00"), None)
    assert slot is None or slot["status"] != "available", \
        "заблокований час не має бути вільним для запису"


@pytest.mark.asyncio
async def test_expired_temporary_lock_does_not_block(client, auth_headers):
    """
    Зворотний бік: ТИМЧАСОВИЙ замок слота має спливати.

    Клієнт відкрив форму й пішов - через 15 хвилин час знову вільний.
    Інакше кинуті форми назавжди зайняли б увесь графік.
    """
    headers = auth_headers("block-expire-owner")
    business_id, service_id = await _setup(client, headers, "Expire Lock Salon")

    target = local_now().date() + timedelta(days=4)
    locked_at = datetime.combine(target, datetime.min.time()).replace(hour=15)

    r = await client.post("/crm/appointments", json={
        "business_id": business_id,
        "start_time": locked_at.isoformat(),
        "duration_minutes": 60,
        "is_block": True,
        "client_name": "Тимчасовий",
    }, headers=headers)
    blocked_id = r.json()["id"]

    # Робимо замок простроченим
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "UPDATE appointments SET expires_at = $1 WHERE id = $2",
            datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1),
            blocked_id,
        )
    finally:
        await conn.close()

    r = await client.get(
        f"/appointments/available-slots?business_id={business_id}"
        f"&service_id={service_id}&target_date={target.isoformat()}"
    )
    slot = next((s for s in r.json()["slots"] if s["time"] == "15:00"), None)
    assert slot is not None and slot["status"] == "available", \
        "прострочений замок має звільняти час"


@pytest.mark.asyncio
async def test_block_can_be_deleted(client, auth_headers):
    """Блокування має зніматись - інакше помилковий обід не прибрати."""
    headers = auth_headers("block-delete-owner")
    business_id, _ = await _setup(client, headers, "Block Delete Salon")

    start = local_now().replace(microsecond=0) + timedelta(days=5)
    r = await client.post("/crm/appointments", json={
        "business_id": business_id,
        "start_time": start.isoformat(),
        "duration_minutes": 60,
        "is_block": True,
        "client_name": "Помилкова перерва",
    }, headers=headers)
    blocked_id = r.json()["id"]

    r = await client.delete(f"/crm/appointments/{blocked_id}", headers=headers)
    assert r.status_code in (200, 204), r.text

    r = await client.get(f"/appointments/booked?business_id={business_id}", headers=headers)
    assert blocked_id not in [a["id"] for a in r.json()]


@pytest.mark.asyncio
async def test_reschedule_keeps_local_time(client, auth_headers):
    """
    Перетягування зсувало запис на 3 години.

    Причина: створення шле локальний час без зони («14:00» лягає
    в базу як 14:00), а перенесення слало UTC через toISOString()
    на фронтенді - і 14:00 за Києвом ставало 11:00 у базі.

    Дві різні угоди про час в одній таблиці неминуче розходяться.
    """
    headers = auth_headers("reschedule-tz-owner")
    business_id, service_id = await _setup(client, headers, "Reschedule TZ Salon")

    target = local_now().date() + timedelta(days=6)
    start = datetime.combine(target, datetime.min.time()).replace(hour=11)

    r = await client.post("/crm/appointments", json={
        "business_id": business_id,
        "service_id": service_id,
        "start_time": start.isoformat(),
        "client_name": "Клієнт",
        "client_phone": "+380671112233",
    }, headers=headers)
    assert r.status_code in (200, 201), r.text
    appointment_id = r.json()["id"]

    # Відтворюємо саме те, що робить браузер при перетягуванні:
    #   new Date("2026-09-24T14:00:00").toISOString()
    # Дата створюється в локальному поясі, а toISOString дає UTC.
    # Тобто для 14:00 за Києвом летить 11:00Z.
    from zoneinfo import ZoneInfo
    new_start_local = start.replace(hour=14, tzinfo=ZoneInfo("Europe/Kyiv"))
    as_browser_sends = new_start_local.astimezone(timezone.utc)

    r = await client.patch(
        f"/crm/appointments/{appointment_id}/reschedule",
        json={"start_time": as_browser_sends.isoformat()},
        headers=headers,
    )
    assert r.status_code == 200, r.text

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        stored = await conn.fetchval(
            "SELECT start_time FROM appointments WHERE id = $1", appointment_id
        )
    finally:
        await conn.close()

    assert stored.hour == 14, (
        f"запис має лишитись о 14:00, а не зсунутись на {stored.hour}:00"
    )
