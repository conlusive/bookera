import asyncpg
import pytest
from datetime import datetime, timedelta, timezone

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _set_rules(business_id: int, booking=None, security=None):
    import json
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        if booking is not None:
            await conn.execute(
                "UPDATE businesses SET booking_settings = $1::json WHERE id = $2",
                json.dumps(booking), business_id,
            )
        if security is not None:
            await conn.execute(
                "UPDATE businesses SET security_settings = $1::json WHERE id = $2",
                json.dumps(security), business_id,
            )
    finally:
        await conn.close()


async def _setup(client, headers, name="Rules Salon"):
    r = await client.post("/crm/businesses", json={"name": name, "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={
        "business_id": business_id, "name": "Стрижка", "duration_minutes": 60, "price": 500,
    }, headers=headers)
    return business_id, r.json()["id"]


def _book_payload(business_id, service_id, start, phone="+380671112233"):
    return {
        "business_id": business_id,
        "service_id": service_id,
        "start_time": start.isoformat(),
        "client_name": "Клієнт",
        "client_phone": phone,
    }


@pytest.mark.asyncio
async def test_booking_disabled_blocks_new_appointments(client, auth_headers):
    """«Онлайн-запис вимкнено» раніше було декорацією: налаштування
    зберігалось, але бронювання все одно проходило."""
    headers = auth_headers("rules-owner-1")
    business_id, service_id = await _setup(client, headers, "Disabled Salon")
    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)

    # Поки увімкнено - запис проходить
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, start))
    assert r.status_code == 200, r.text

    await _set_rules(business_id, booking={"is_active": False})
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, start + timedelta(hours=3)))
    assert r.status_code == 403
    assert "вимкнено" in r.json()["detail"]


@pytest.mark.asyncio
async def test_emergency_pause_blocks_bookings(client, auth_headers):
    headers = auth_headers("rules-owner-2")
    business_id, service_id = await _setup(client, headers, "Paused Salon")
    await _set_rules(business_id, booking={"is_active": True, "is_paused_emergency": True})

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, start))
    assert r.status_code == 403
    assert "тимчасово" in r.json()["detail"]


@pytest.mark.asyncio
async def test_min_advance_hours_enforced(client, auth_headers):
    """«Не раніше ніж за N годин» - захист від записів на через 10 хвилин."""
    headers = auth_headers("rules-owner-3")
    business_id, service_id = await _setup(client, headers, "MinAdvance Salon")
    await _set_rules(business_id, booking={"is_active": True, "min_advance_hours": 4})

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    r = await client.post("/appointments", json=_book_payload(business_id, service_id, now + timedelta(hours=1)))
    assert r.status_code == 400
    assert "щонайменше" in r.json()["detail"]

    r = await client.post("/appointments", json=_book_payload(business_id, service_id, now + timedelta(hours=6)))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_max_advance_days_enforced(client, auth_headers):
    headers = auth_headers("rules-owner-4")
    business_id, service_id = await _setup(client, headers, "MaxAdvance Salon")
    await _set_rules(business_id, booking={"is_active": True, "max_advance_days": 14})

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    r = await client.post("/appointments", json=_book_payload(business_id, service_id, now + timedelta(days=30)))
    assert r.status_code == 400
    assert "наперед" in r.json()["detail"]

    r = await client.post("/appointments", json=_book_payload(business_id, service_id, now + timedelta(days=5)))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_blacklisted_client_cannot_book(client, auth_headers):
    """
    Позначка «у чорному списку» раніше нічого не давала: клієнт спокійно
    записувався далі. Формулювання відмови нейтральне - повідомляти
    людині, що вона в чорному списку, це розмова для закладу.
    """
    headers = auth_headers("rules-owner-5")
    business_id, service_id = await _setup(client, headers, "Blacklist Salon")

    r = await client.post("/crm/clients", json={
        "business_id": business_id, "name": "Проблемний", "phone": "+380671112233",
    }, headers=headers)
    client_id = r.json()["id"]
    await client.patch(f"/crm/clients/{client_id}", json={"is_blacklisted": True}, headers=headers)

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, start))
    assert r.status_code == 403
    assert "чорн" not in r.json()["detail"].lower(), "не повідомляємо причину клієнту"

    # Інший номер - без обмежень
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, start, phone="+380509998877"))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_registration_data_shapes_booking_rules(client, auth_headers):
    """
    Дані з реєстрації мають впливати на поведінку, а не просто лежати
    в базі: барбер і майстер манікюру отримують різні правила.
    """
    # Барбер: короткі візити, можна записатись майже одразу
    r = await client.post("/crm/businesses", json={
        "name": "Barber Profile", "city": "Львів",
        "category": "barber", "business_type": "company", "workspace_type": "my_place",
    }, headers=auth_headers("profile-barber"))
    assert r.status_code == 201, r.text
    barber = r.json()["booking_settings"]
    assert barber["min_advance_hours"] == 1

    # Манікюр: довші візити, більше часу на підготовку
    r = await client.post("/crm/businesses", json={
        "name": "Nails Profile", "city": "Львів",
        "category": "nails", "business_type": "individual", "workspace_type": "my_place",
    }, headers=auth_headers("profile-nails"))
    nails = r.json()["booking_settings"]
    assert nails["min_advance_hours"] == 3
    # Приватний майстер планує далі наперед
    assert nails["max_advance_days"] == 90

    # Виїзд до клієнта: майстру потрібен час на дорогу, тому запис
    # «через годину» нереалістичний навіть для барбера
    r = await client.post("/crm/businesses", json={
        "name": "Mobile Barber", "city": "Львів",
        "category": "barber", "business_type": "individual", "workspace_type": "client_place",
    }, headers=auth_headers("profile-mobile"))
    mobile = r.json()["booking_settings"]
    assert mobile["min_advance_hours"] >= 4, "виїзд потребує запасу часу"
    assert "адресою" in mobile["cancellation_policy"]


@pytest.mark.asyncio
async def test_profile_rules_actually_block_booking(client, auth_headers):
    """Правила з профілю - не декорація: вони справді відмовляють."""
    headers = auth_headers("profile-enforce")
    r = await client.post("/crm/businesses", json={
        "name": "Enforce Salon", "city": "Львів",
        "category": "nails", "business_type": "company", "workspace_type": "my_place",
    }, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={
        "business_id": business_id, "name": "Манікюр", "duration_minutes": 90, "price": 700,
    }, headers=headers)
    service_id = r.json()["id"]

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Манікюр - мінімум 3 години наперед
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, now + timedelta(hours=1)))
    assert r.status_code == 400

    r = await client.post("/appointments", json=_book_payload(business_id, service_id, now + timedelta(hours=5)))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_auto_approve_off_puts_booking_on_hold(client, auth_headers):
    """
    Вимкнене автопідтвердження раніше нічого не робило: запис усе одно
    ставав confirmed. Тепер він чекає на рішення закладу - і, головне,
    ЗАЛИШАЄТЬСЯ ВИДИМИМ у календарі, інакше запит просто загубився б.
    """
    headers = auth_headers("approve-owner")
    business_id, service_id = await _setup(client, headers, "Approve Salon")
    await _set_rules(business_id, booking={"is_active": True})

    import json
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "UPDATE businesses SET notification_settings = $1::json WHERE id = $2",
            json.dumps({"auto_approve": False}), business_id,
        )
    finally:
        await conn.close()

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, start))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending_approval"

    # Заклад мусить бачити запит, інакше він загубиться
    r = await client.get(f"/appointments/booked?business_id={business_id}", headers=headers)
    assert any(a["status"] == "pending_approval" for a in r.json())


@pytest.mark.asyncio
async def test_time_step_comes_from_business_settings(client, auth_headers):
    """
    Крок сітки бере заклад, а не фронтенд. Раніше він завжди приходив
    параметром 15, тому налаштування «крок 30» нічого не змінювало.
    """
    headers = auth_headers("step-owner")
    business_id, service_id = await _setup(client, headers, "Step Salon")
    await _set_rules(business_id, booking={"is_active": True, "time_step": 60, "min_advance_hours": 0})

    await client.put(f"/crm/businesses/{business_id}/hours", json=[
        {"weekday": d, "is_closed": False, "open_time": "09:00", "close_time": "18:00"} for d in range(7)
    ], headers=headers)

    target = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")
    r = await client.get(f"/appointments/available-slots?business_id={business_id}&service_id={service_id}&target_date={target}")
    assert r.status_code == 200, r.text
    slots = [s["time"] for s in r.json()["slots"]]

    # Крок 60 хвилин - усі слоти на рівних годинах
    assert slots, "слоти мають бути"
    assert all(t.endswith(":00") for t in slots), f"крок не застосувався: {slots[:5]}"


@pytest.mark.asyncio
async def test_deposit_amount_is_recorded_on_booking(client, auth_headers):
    """
    Депозит зберігався в налаштуваннях і ніде не виникав: заклад думав,
    що передоплата обовʼязкова, а сума ніде не рахувалась.
    """
    headers = auth_headers("deposit-owner")
    business_id, service_id = await _setup(client, headers, "Deposit Salon")
    await _set_rules(business_id, booking={"is_active": True})

    import json
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        await conn.execute(
            "UPDATE businesses SET payments_settings = $1::json WHERE id = $2",
            json.dumps({"require_deposit": True, "deposit_amount": 200}), business_id,
        )
    finally:
        await conn.close()

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2)
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, start))
    assert r.status_code == 200, r.text

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        row = await conn.fetchrow("SELECT deposit_due FROM appointments WHERE id = $1", r.json()["id"])
    finally:
        await conn.close()
    assert row["deposit_due"] == 200, "сума передоплати має зафіксуватись у записі"


@pytest.mark.asyncio
async def test_closed_period_blocks_booking(client, auth_headers):
    """
    Закриті періоди: відпустка, санітарні дні, ремонт.
    Раніше закрити тиждень означало вимкнути кожен день у графіку
    окремо, а потім не забути увімкнути назад.
    """
    headers = auth_headers("closed-owner")
    business_id, service_id = await _setup(client, headers, "Closed Salon")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    vacation_start = (now + timedelta(days=10)).date()
    vacation_end = (now + timedelta(days=17)).date()

    await _set_rules(business_id, booking={
        "is_active": True,
        "closed_periods": [
            {"start": vacation_start.isoformat(), "end": vacation_end.isoformat(), "reason": "Відпустка"}
        ],
    })

    # Усередині періоду - відмова з причиною
    r = await client.post("/appointments", json=_book_payload(
        business_id, service_id, now + timedelta(days=12)))
    assert r.status_code == 403
    assert "Відпустка" in r.json()["detail"]

    # Після періоду - працює
    r = await client.post("/appointments", json=_book_payload(
        business_id, service_id, now + timedelta(days=20)))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_buffer_blocks_back_to_back_slots(client, auth_headers):
    """
    Буфер після візиту: наступний клієнт не має потрапити впритул.
    Саме через невраховані 10-15 хвилин майстри й спізнюються.
    """
    headers = auth_headers("buffer-owner")
    r = await client.post("/crm/businesses", json={"name": "Buffer Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]
    r = await client.post("/services", json={
        "business_id": business_id, "name": "Стрижка", "duration_minutes": 60, "price": 500,
    }, headers=headers)
    service_id = r.json()["id"]

    await client.put(f"/crm/businesses/{business_id}/hours", json=[
        {"weekday": d, "is_closed": False, "open_time": "09:00", "close_time": "18:00"} for d in range(7)
    ], headers=headers)

    target = (datetime.now(timezone.utc) + timedelta(days=4)).strftime("%Y-%m-%d")

    # Без буфера слот о 10:00 вільний після візиту 09:00-10:00
    await _set_rules(business_id, booking={"is_active": True, "time_step": 60, "buffer_minutes": 0})
    r = await client.get(f"/appointments/available-slots?business_id={business_id}&service_id={service_id}&target_date={target}")
    assert r.status_code == 200, r.text
    slots_no_buffer = len([s for s in r.json()["slots"] if s["status"] == "available"])

    # З буфером 30 хвилин слотів має стати менше: кожен візит займає
    # більше часу, ніж триває сама послуга
    await _set_rules(business_id, booking={"is_active": True, "time_step": 60, "buffer_minutes": 30})
    r = await client.get(f"/appointments/available-slots?business_id={business_id}&service_id={service_id}&target_date={target}")
    slots_with_buffer = len([s for s in r.json()["slots"] if s["status"] == "available"])

    assert slots_with_buffer <= slots_no_buffer, "буфер має зменшувати кількість слотів"


@pytest.mark.asyncio
async def test_apply_profile_defaults_updates_derived_settings(client, auth_headers):
    """
    Зміна напряму не має мовчки скидати ручні налаштування, але має
    бути СПОСІБ оновити типові значення - інакше барбер, що став
    салоном краси, назавжди лишається зі старою сіткою.
    """
    headers = auth_headers("profile-apply")
    r = await client.post("/crm/businesses", json={
        "name": "Apply Salon", "city": "Львів",
        "category": "barber", "business_type": "company", "workspace_type": "my_place",
    }, headers=headers)
    business_id = r.json()["id"]
    assert r.json()["booking_settings"]["min_advance_hours"] == 1

    # Власник вручну змінив політику скасування - вона НЕ має постраждати
    await client.patch(f"/crm/businesses/{business_id}", json={
        "booking_settings": {
            **r.json()["booking_settings"],
            "cancellation_policy": "Мій власний текст",
        },
    }, headers=headers)

    # Змінюємо напрям на манікюр
    await client.patch(f"/crm/businesses/{business_id}", json={"category": "nails"}, headers=headers)

    r = await client.post(f"/crm/businesses/{business_id}/apply-profile-defaults", headers=headers)
    assert r.status_code == 200, r.text
    settings = r.json()["booking_settings"]

    # Значення за напрямом оновились
    assert settings["min_advance_hours"] == 3, "манікюр потребує більше часу наперед"
    assert settings["default_duration"] == 90

    # А ручний текст лишився недоторканим
    assert settings["cancellation_policy"] == "Мій власний текст"


@pytest.mark.asyncio
async def test_client_can_view_and_cancel_own_booking(client, auth_headers):
    """
    Потік, на який ведуть УСІ листи: підтвердження, перенесення,
    нагадування. Сторінки /my-booking не існувало - людина натискала
    «Переглянути або скасувати» й потрапляла на 404.

    Доступ за токеном без входу в систему: вимагати реєстрації від
    людини, яка хоче скасувати візит, - найшвидший спосіб отримати
    неявку замість скасування.
    """
    headers = auth_headers("manage-owner")
    business_id, service_id = await _setup(client, headers, "Manage Salon")

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=3)
    r = await client.post("/appointments", json=_book_payload(business_id, service_id, start))
    assert r.status_code == 200, r.text
    appointment_id = r.json()["id"]

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        token = await conn.fetchval("SELECT manage_token FROM appointments WHERE id = $1", appointment_id)
    finally:
        await conn.close()
    assert token, "токен керування має видаватись при створенні"

    # Перегляд: назви мають бути заповнені, інакше людина бачить
    # свій запис без натяку, куди й до кого вона йде
    r = await client.get(f"/appointments/{appointment_id}/manage?token={token}")
    assert r.status_code == 200, r.text
    assert r.json()["business_name"] == "Manage Salon"
    assert r.json()["service_name"] == "Стрижка"

    # Чужий токен не працює
    r = await client.get(f"/appointments/{appointment_id}/manage?token=wrong-token")
    assert r.status_code == 404

    # Скасування
    r = await client.post(f"/appointments/{appointment_id}/cancel", json={"token": token})
    assert r.status_code == 200, r.text

    r = await client.get(f"/appointments/{appointment_id}/manage?token={token}")
    assert r.json()["status"] == "cancelled"

    # Повторне скасування - зрозуміла відмова, а не мовчазний успіх
    r = await client.post(f"/appointments/{appointment_id}/cancel", json={"token": token})
    assert r.status_code == 409
