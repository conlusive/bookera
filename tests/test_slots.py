import pytest
from datetime import datetime, timedelta

from app.core.time_utils import local_now

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _salon_with_hours(client, headers, name, hours):
    """
    Заклад із заданим графіком.

    hours: список (weekday, open, close) або None для вихідного.
    weekday: 0 = понеділок ... 6 = неділя.
    """
    r = await client.post("/crm/businesses", json={"name": name, "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.post("/services", json={
        "business_id": business_id, "name": "Стрижка", "duration_minutes": 60, "price": 400,
    }, headers=headers)
    service_id = r.json()["id"]

    payload = []
    for weekday in range(7):
        found = next((h for h in hours if h[0] == weekday), None)
        payload.append({
            "weekday": weekday,
            "is_closed": found is None,
            "is_open": found is not None,
            "open_time": found[1] if found else "09:00",
            "close_time": found[2] if found else "18:00",
        })

    r = await client.put(f"/crm/businesses/{business_id}/hours", json=payload, headers=headers)
    assert r.status_code in (200, 204), r.text
    return business_id, service_id


@pytest.mark.asyncio
async def test_past_slots_hidden_for_today(client, auth_headers):
    """
    Головний баг: о 12:00 за Києвом показувались слоти з 10:00.

    Причина - порівняння з UTC-часом. Влітку різниця з Києвом 3 години,
    тому «зараз» для сервера було 09:00, і слоти з 10:00 виглядали
    майбутніми, хоча вже минули.
    """
    headers = auth_headers("slots-past-owner")
    # Заклад працює цілий день, щоб слоти були і до, і після «зараз»
    business_id, service_id = await _salon_with_hours(
        client, headers, "Past Slots Salon",
        [(wd, "00:00", "23:00") for wd in range(7)],
    )

    now_local = local_now()
    today = now_local.strftime("%Y-%m-%d")

    r = await client.get(
        f"/appointments/available-slots?business_id={business_id}"
        f"&service_id={service_id}&target_date={today}"
    )
    assert r.status_code == 200, r.text
    times = [s["time"] for s in r.json()["slots"]]

    # Жоден слот не має бути в минулому
    for t in times:
        hh, mm = map(int, t.split(":"))
        slot = now_local.replace(hour=hh, minute=mm, second=0, microsecond=0)
        assert slot >= now_local, f"слот {t} уже минув (зараз {now_local:%H:%M})"


@pytest.mark.asyncio
async def test_saturday_hours_respected(client, auth_headers):
    """
    Другий баг: заклад працює в суботу 12:00-16:00, але слотів немає.

    Перевіряємо і що субота відкрита, і що слоти лежать саме в межах
    заданих годин - помилка на одиницю в нумерації днів дала б слоти
    з пʼятниці або неділі.
    """
    headers = auth_headers("slots-sat-owner")
    # Працює ЛИШЕ в суботу (weekday=5), з 12:00 до 16:00
    business_id, service_id = await _salon_with_hours(
        client, headers, "Saturday Salon", [(5, "12:00", "16:00")],
    )

    # Найближча субота, але не сьогодні - щоб перевірка минулого часу
    # не втручалась у результат
    d = local_now().date() + timedelta(days=1)
    while d.weekday() != 5:
        d += timedelta(days=1)

    r = await client.get(
        f"/appointments/available-slots?business_id={business_id}"
        f"&service_id={service_id}&target_date={d.isoformat()}"
    )
    assert r.status_code == 200, r.text
    times = [s["time"] for s in r.json()["slots"]]
    assert times, "субота відкрита - слоти мають бути"

    for t in times:
        hh, mm = map(int, t.split(":"))
        minutes = hh * 60 + mm
        assert 12 * 60 <= minutes, f"слот {t} раніший за відкриття 12:00"
        # Останній слот має вміститись до закриття разом із тривалістю
        assert minutes + 60 <= 16 * 60, f"слот {t} не встигає до закриття 16:00"


@pytest.mark.asyncio
async def test_closed_day_returns_no_slots(client, auth_headers):
    """Вихідний день не має давати слотів узагалі."""
    headers = auth_headers("slots-closed-owner")
    business_id, service_id = await _salon_with_hours(
        client, headers, "Closed Sunday Salon", [(5, "12:00", "16:00")],
    )

    # Неділя - закрито
    d = local_now().date() + timedelta(days=1)
    while d.weekday() != 6:
        d += timedelta(days=1)

    r = await client.get(
        f"/appointments/available-slots?business_id={business_id}"
        f"&service_id={service_id}&target_date={d.isoformat()}"
    )
    assert r.status_code == 200, r.text
    assert r.json()["slots"] == [], "у вихідний слотів бути не має"


@pytest.mark.asyncio
async def test_public_page_gets_working_hours(client, auth_headers):
    """
    Сторінка салону визначала вихідні за застарілим полем days_off,
    а CRM зберігає графік у business_hours. Заклад міняв суботу
    в кабінеті, а клієнт бачив її закритою - сторінка дивилась
    в інше місце.

    Тепер заклад віддає working_hours: те саме джерело, що й CRM.
    """
    headers = auth_headers("public-hours-owner")
    business_id, _ = await _salon_with_hours(
        client, headers, "Public Hours Salon", [(5, "12:00", "16:00")],
    )

    r = await client.get(f"/crm/businesses/me", headers=headers)
    slug = r.json()["business"]["slug"]

    r = await client.get(f"/businesses/{slug}")
    assert r.status_code == 200, r.text

    hours = r.json().get("working_hours")
    assert hours, "публічна сторінка має отримувати графік"

    saturday = next(h for h in hours if h["weekday"] == 5)
    assert saturday["is_open"] is True, "субота відкрита в CRM - має бути відкрита й тут"
    assert saturday["open_time"] == "12:00"

    monday = next(h for h in hours if h["weekday"] == 0)
    assert monday["is_open"] is False, "понеділок закритий"


@pytest.mark.asyncio
async def test_duration_param_shrinks_available_slots(client, auth_headers):
    """
    Тривалість візиту з додатковими послугами має впливати на сітку.

    Без цього людина обирала стрижку з бородою на 70 хвилин, а слот
    на 19:00 показувався вільним - хоча заклад закривається о 20:00
    і візит не вміщається.
    """
    headers = auth_headers("duration-param-owner")
    business_id, service_id = await _salon_with_hours(
        client, headers, "Duration Salon",
        [(wd, "09:00", "18:00") for wd in range(7)],
    )

    d = (local_now().date() + timedelta(days=3)).isoformat()
    base = f"/appointments/available-slots?business_id={business_id}&service_id={service_id}&target_date={d}"

    r = await client.get(base)
    short_slots = [s["time"] for s in r.json()["slots"]]

    # Той самий день, але візит на 3 години
    r = await client.get(f"{base}&duration_minutes=180")
    long_slots = [s["time"] for s in r.json()["slots"]]

    assert len(long_slots) < len(short_slots), "довший візит - менше слотів"
    # Останній слот має вміститись до закриття о 18:00
    last = long_slots[-1]
    hh, mm = map(int, last.split(":"))
    assert hh * 60 + mm + 180 <= 18 * 60, f"слот {last} не встигає до закриття"
