import asyncpg
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _setup_with_appointment(client, headers, hours_ahead: float, name: str):
    """Створює заклад із записом через N годин від зараз."""
    r = await client.post("/crm/businesses", json={"name": name, "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={
        "business_id": business_id, "name": "Стрижка", "duration_minutes": 60, "price": 400,
    }, headers=headers)
    service_id = r.json()["id"]

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=hours_ahead)
    r = await client.post("/appointments", json={
        "business_id": business_id, "service_id": service_id,
        "start_time": start.isoformat(),
        "client_name": "Клієнт", "client_phone": "+380671234567",
        "client_email": "client@test.com",
    })
    assert r.status_code == 200, r.text
    return business_id, r.json()["id"]


async def _run_reminders():
    """Запускає один прохід нагадувань із підміненою відправкою пошти."""
    from app.core.database import AsyncSessionLocal
    from app.services import reminders

    sent_emails = []

    async def fake_send(**kwargs):
        sent_emails.append(kwargs)

    with patch.object(reminders, "send_booking_reminder_email", side_effect=fake_send):
        async with AsyncSessionLocal() as db:
            count = await reminders.send_due_reminders(db, "http://localhost:3000")

    return count, sent_emails


@pytest.mark.asyncio
async def test_reminder_sent_for_tomorrow_visit(client, auth_headers):
    """
    Візит за добу - нагадування має піти. Це найдешевший спосіб
    зменшити неявки: людина записалась тиждень тому й забула.
    """
    headers = auth_headers("reminder-owner-1")
    _, appointment_id = await _setup_with_appointment(client, headers, 24, "Reminder Salon 1")

    count, emails = await _run_reminders()
    assert count >= 1
    assert any(e["to_email"] == "client@test.com" for e in emails)

    # Посилання на скасування - головне в цьому листі: якщо людина
    # все одно не прийде, слот ще можна віддати комусь іншому
    ours = next(e for e in emails if e["to_email"] == "client@test.com")
    assert "my-booking" in ours["manage_url"]


@pytest.mark.asyncio
async def test_reminder_not_sent_twice(client, auth_headers):
    """
    Повторне нагадування - гірше за жодне: людина починає сприймати
    листи закладу як спам.
    """
    headers = auth_headers("reminder-owner-2")
    await _setup_with_appointment(client, headers, 24, "Reminder Salon 2")

    first, _ = await _run_reminders()
    assert first >= 1

    second, emails = await _run_reminders()
    assert not any(e["business_name"] == "Reminder Salon 2" for e in emails)


@pytest.mark.asyncio
async def test_reminder_skipped_outside_window(client, auth_headers):
    """
    Візит за тиждень - зарано: нагадування має прийти за добу, інакше
    людина знову забуде.
    """
    headers = auth_headers("reminder-owner-3")
    await _setup_with_appointment(client, headers, 24 * 7, "Reminder Salon Far")

    _, emails = await _run_reminders()
    assert not any(e["business_name"] == "Reminder Salon Far" for e in emails)


@pytest.mark.asyncio
async def test_reminder_respects_business_setting(client, auth_headers):
    """Вимкнене нагадування в налаштуваннях має справді вимикати його."""
    import json

    headers = auth_headers("reminder-owner-4")
    business_id, _ = await _setup_with_appointment(client, headers, 24, "Reminder Salon Off")

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "UPDATE businesses SET notification_settings = $1::json WHERE id = $2",
            json.dumps({"notify_client_reminder_sms": False}), business_id,
        )
    finally:
        await conn.close()

    _, emails = await _run_reminders()
    assert not any(e["business_name"] == "Reminder Salon Off" for e in emails)


@pytest.mark.asyncio
async def test_reminder_skipped_for_expired_subscription(client, auth_headers):
    """
    Заклад без чинної підписки не розсилає нічого: сервіс не має
    працювати від його імені, поки не оплачений.
    """
    headers = auth_headers("reminder-owner-5")
    business_id, _ = await _setup_with_appointment(client, headers, 24, "Reminder Salon Expired")

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "UPDATE businesses SET subscription_plan='expired', subscription_until=NULL WHERE id=$1",
            business_id,
        )
    finally:
        await conn.close()

    _, emails = await _run_reminders()
    assert not any(e["business_name"] == "Reminder Salon Expired" for e in emails)


@pytest.mark.asyncio
async def test_failed_email_does_not_block_others(client, auth_headers):
    """
    Один невдалий лист не має зупиняти решту: якщо в когось некоректна
    адреса, інші клієнти все одно мають отримати нагадування.

    Заодно перевіряємо, що невдалий запис НЕ позначається як
    надісланий - інакше збій пошти означав би, що клієнт не отримає
    нагадування ніколи.
    """
    from app.core.database import AsyncSessionLocal
    from app.services import reminders

    headers = auth_headers("reminder-owner-6")
    await _setup_with_appointment(client, headers, 24, "Reminder Fail Salon")

    async def always_fail(**kwargs):
        raise RuntimeError("SMTP недоступний")

    with patch.object(reminders, "send_booking_reminder_email", side_effect=always_fail):
        async with AsyncSessionLocal() as db:
            count = await reminders.send_due_reminders(db, "")

    assert count == 0, "невдала відправка не рахується як надіслана"

    # Наступна спроба має знову взяти цей запис
    count2, emails = await _run_reminders()
    assert any(e["business_name"] == "Reminder Fail Salon" for e in emails), \
        "запис із невдалою відправкою має спробуватись знову"
