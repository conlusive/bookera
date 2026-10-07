"""Акції: знижка на послугу, на всі послуги, у години (щодня 8:00-10:00), не складаються, ціна в запису = ціна в підказці."""
from datetime import date, datetime, timedelta, timezone

import pytest


def _day(offset=2):
    return (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=offset)).replace(minute=0, second=0, microsecond=0)


async def _salon(client, h):
    bid = (await client.post("/crm/businesses", json={"name": "Promo", "city": "Львів"}, headers=h)).json()["id"]
    a = (await client.post("/services", json={"business_id": bid, "name": "Манікюр", "duration_minutes": 30, "price": 1000}, headers=h)).json()["id"]
    b = (await client.post("/services", json={"business_id": bid, "name": "Педикюр", "duration_minutes": 30, "price": 1000}, headers=h)).json()["id"]
    return bid, a, b


async def _book(client, bid, sid, start, session, phone):
    r = await client.post("/appointments", json={
        "business_id": bid, "service_id": sid, "start_time": start.isoformat(), "session_token": session,
        "client_name": "Клієнт", "client_phone": phone, "client_email": f"{session}@t.com"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.asyncio
async def test_service_discount_applies_only_to_that_service(client, auth_headers):
    h = auth_headers("promo-1")
    bid, a, b = await _salon(client, h)
    r = await client.post("/crm/promotions", params={"business_id": bid}, json={"name": "−10% манікюр", "discount_percent": 10, "service_ids": [a]}, headers=h)
    assert r.status_code == 201, r.text
    start = _day().replace(hour=12)
    assert float((await _book(client, bid, a, start, "p1", "+380671110001"))["price"]) == 900
    assert float((await _book(client, bid, b, start + timedelta(hours=2), "p2", "+380671110002"))["price"]) == 1000


@pytest.mark.asyncio
async def test_time_window_and_best_discount_wins(client, auth_headers):
    h = auth_headers("promo-2")
    bid, a, b = await _salon(client, h)
    await client.post("/crm/promotions", params={"business_id": bid}, json={"name": "Ранок", "discount_percent": 50, "time_from": "08:00", "time_to": "10:00"}, headers=h)
    await client.post("/crm/promotions", params={"business_id": bid}, json={"name": "Усе", "discount_percent": 10}, headers=h)
    day = _day()
    assert float((await _book(client, bid, a, day.replace(hour=9), "w1", "+380671110003"))["price"]) == 500, "у годинах діє найбільша (50%), не сума"
    assert float((await _book(client, bid, a, day.replace(hour=10), "w2", "+380671110004"))["price"]) == 900, "кінець вікна не включно - діє лише 10%"
    quote = (await client.get("/public/quote", params={"business_id": bid, "service_id": a, "start_time": day.replace(hour=8, minute=30).isoformat()})).json()
    assert quote["final_price"] == 500 and quote["base_price"] == 1000 and quote["promotion"]["discount_percent"] == 50


@pytest.mark.asyncio
async def test_weekdays_dates_and_inactive(client, auth_headers):
    h = auth_headers("promo-3")
    bid, a, _ = await _salon(client, h)
    day = _day(3).replace(hour=12)
    other = (day.weekday() + 1) % 7
    await client.post("/crm/promotions", params={"business_id": bid}, json={"name": "Інший день", "discount_percent": 30, "weekdays": [other]}, headers=h)
    await client.post("/crm/promotions", params={"business_id": bid}, json={"name": "Минула", "discount_percent": 30, "date_to": (date.today() - timedelta(days=1)).isoformat()}, headers=h)
    off = await client.post("/crm/promotions", params={"business_id": bid}, json={"name": "Вимкнена", "discount_percent": 30, "is_active": False}, headers=h)
    assert off.status_code == 201
    assert float((await _book(client, bid, a, day, "d1", "+380671110005"))["price"]) == 1000, "жодна з акцій не підходить"
    public = (await client.get("/public/promotions", params={"business_id": bid})).json()
    assert [p["name"] for p in public] == ["Інший день"], "публічно видно лише чинні й не прострочені"


@pytest.mark.asyncio
async def test_validation_and_access(client, auth_headers):
    h = auth_headers("promo-4")
    bid, a, _ = await _salon(client, h)
    bad = [
        {"name": "x", "discount_percent": 10},
        {"name": "Багато", "discount_percent": 95},
        {"name": "Година", "discount_percent": 10, "time_from": "08:00"},
        {"name": "Дати", "discount_percent": 10, "date_from": "2026-12-10", "date_to": "2026-12-01"},
        {"name": "Чужа", "discount_percent": 10, "service_ids": [999999]},
    ]
    for body in bad:
        r = await client.post("/crm/promotions", params={"business_id": bid}, json=body, headers=h)
        assert r.status_code in (409, 422), (body, r.status_code)
    other = auth_headers("promo-stranger")
    assert (await client.get("/crm/promotions", params={"business_id": bid}, headers=other)).status_code in (401, 403)
    ok = await client.post("/crm/promotions", params={"business_id": bid}, json={"name": "Гаразд", "discount_percent": 15}, headers=h)
    pid = ok.json()["id"]
    upd = await client.put(f"/crm/promotions/{pid}", json={"name": "Гаразд", "discount_percent": 20}, headers=h)
    assert upd.status_code == 200 and upd.json()["discount_percent"] == 20
    assert (await client.delete(f"/crm/promotions/{pid}", headers=h)).status_code == 204
    assert (await client.get("/crm/promotions", params={"business_id": bid}, headers=h)).json() == []


@pytest.mark.asyncio
async def test_missing_promotions_table_does_not_break_booking(client, auth_headers):
    """Базу ще не оновлено (немає таблиці акцій): запис і вітрина працюють без акцій, кабінет чесно каже, що треба оновити базу."""
    import asyncpg
    h = auth_headers("promo-5")
    bid, a, _ = await _salon(client, h)
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/bookera_test")
    try:
        await conn.execute("ALTER TABLE promotions RENAME TO promotions_hidden")
        booked = await _book(client, bid, a, _day().replace(hour=12), "m1", "+380671110099")
        assert float(booked["price"]) == 1000
        assert (await client.get("/public/promotions", params={"business_id": bid})).json() == []
        listing = await client.get("/crm/promotions", params={"business_id": bid}, headers=h)
        assert listing.status_code == 503 and "оновити" in listing.json()["detail"]
    finally:
        await conn.execute("ALTER TABLE promotions_hidden RENAME TO promotions")
        await conn.close()
