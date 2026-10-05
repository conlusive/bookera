"""
Налаштування, що діють: слоти показують лише те, що запис прийме,
а депозит рахується за типом (фіксований / відсоток).
"""
import json

import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _set(business_id, **cols):
    conn = await asyncpg.connect(DB)
    try:
        for col, value in cols.items():
            await conn.execute(f"UPDATE businesses SET {col} = $1::json WHERE id = $2", json.dumps(value), business_id)
    finally:
        await conn.close()


async def _setup(client, auth_headers, tag, price=500):
    h = auth_headers(f"sr-{tag}")
    bid = (await client.post("/crm/businesses", json={"name": "Правила", "city": "Львів"}, headers=h)).json()["id"]
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": price}, headers=h)).json()["id"]
    return bid, sid


async def _slots(client, bid, sid, day):
    r = await client.get("/appointments/available-slots", params={"business_id": bid, "service_id": sid, "target_date": str(day)})
    assert r.status_code == 200, r.text
    return [s["time"] for s in r.json()["slots"] if s["status"] == "available"]


async def _deposit(response):
    assert response.status_code == 200, response.text
    conn = await asyncpg.connect(DB)
    try:
        v = await conn.fetchval("SELECT deposit_due FROM appointments WHERE id = $1", response.json()["id"])
    finally:
        await conn.close()
    return float(v) if v is not None else None


def _today():
    return local_now().date()


@pytest.mark.asyncio
async def test_slots_hide_closed_periods_and_paused_booking(client, auth_headers):
    bid, sid = await _setup(client, auth_headers, "cl")
    d = _today() + timedelta(days=5)
    assert await _slots(client, bid, sid, d), "без правил слоти є"

    await _set(bid, booking_settings={"closed_periods": [{"start": str(d), "end": str(d + timedelta(days=2)), "reason": "Відпустка"}]})
    assert await _slots(client, bid, sid, d) == []
    assert await _slots(client, bid, sid, d + timedelta(days=2)) == []
    assert await _slots(client, bid, sid, d + timedelta(days=3)), "після відпустки - знову є"

    await _set(bid, booking_settings={"is_paused_emergency": True})
    assert await _slots(client, bid, sid, d + timedelta(days=3)) == []
    await _set(bid, booking_settings={"is_active": False})
    assert await _slots(client, bid, sid, d + timedelta(days=3)) == []


@pytest.mark.asyncio
async def test_slots_respect_how_far_ahead_and_how_soon(client, auth_headers):
    bid, sid = await _setup(client, auth_headers, "adv")
    await _set(bid, booking_settings={"max_advance_days": 3})
    assert await _slots(client, bid, sid, _today() + timedelta(days=2))
    assert await _slots(client, bid, sid, _today() + timedelta(days=10)) == [], "далі, ніж на 3 дні, не записують"

    await _set(bid, booking_settings={"min_advance_hours": 48})
    assert await _slots(client, bid, sid, _today() + timedelta(days=1)) == [], "завтра - раніше, ніж за 48 годин"
    assert await _slots(client, bid, sid, _today() + timedelta(days=4)), "через 4 дні - вільно"


@pytest.mark.asyncio
async def test_min_advance_uses_the_salons_clock_not_utc(client, auth_headers):
    bid, sid = await _setup(client, auth_headers, "loc")
    await _set(bid, booking_settings={"min_advance_hours": 2})
    local = local_now().replace(tzinfo=None, second=0, microsecond=0)
    base = {"business_id": bid, "service_id": sid, "client_name": "К", "client_phone": "+380671112233"}
    soon = (local + timedelta(minutes=40)).replace(day=local.day)
    r = await client.post("/appointments", json={**base, "start_time": (local + timedelta(days=1)).isoformat()})
    assert r.status_code == 200, "завтра о цій самій годині - добре"
    # за 40 хвилин за годинником закладу - уже зарано (UTC-порівняння пропускало б це в Києві)
    r = await client.post("/appointments", json={**base, "client_phone": "+380671119999", "start_time": soon.isoformat()})
    assert r.status_code == 400 and "щонайменше" in r.json()["detail"]


@pytest.mark.asyncio
async def test_deposit_percent_fixed_and_capped(client, auth_headers):
    bid, sid = await _setup(client, auth_headers, "dep", price=500)
    cheap = (await client.post("/services", json={"business_id": bid, "name": "Експрес", "duration_minutes": 30, "price": 150},
                               headers=auth_headers("sr-dep"))).json()["id"]
    tomorrow = local_now().replace(tzinfo=None, minute=0, second=0, microsecond=0) + timedelta(days=1)
    base = {"business_id": bid, "client_name": "К", "client_phone": "+380671112233"}

    await _set(bid, payments_settings={"require_deposit": True, "deposit_type": "percent", "deposit_amount": 20})
    r = await client.post("/appointments", json={**base, "service_id": sid, "start_time": tomorrow.isoformat()})
    assert await _deposit(r) == 100.0, "20% від 500, а не 20 ₴"

    await _set(bid, payments_settings={"require_deposit": True, "deposit_type": "fixed", "deposit_amount": 200})
    r = await client.post("/appointments", json={**base, "client_phone": "+380671110000", "service_id": sid, "start_time": (tomorrow + timedelta(hours=2)).isoformat()})
    assert await _deposit(r) == 200.0

    r = await client.post("/appointments", json={**base, "client_phone": "+380671110001", "service_id": cheap, "start_time": (tomorrow + timedelta(hours=4)).isoformat()})
    assert await _deposit(r) == 150.0, "депозит не більший за саму послугу"

    await _set(bid, payments_settings={"require_deposit": False, "deposit_type": "percent", "deposit_amount": 20})
    r = await client.post("/appointments", json={**base, "client_phone": "+380671110002", "service_id": sid, "start_time": (tomorrow + timedelta(hours=6)).isoformat()})
    assert await _deposit(r) is None


def test_cancel_violation_rule():
    from datetime import datetime, timedelta
    from app.services import booking_rules as br
    now = datetime(2026, 1, 10, 12, 0)
    assert br.cancel_violation({}, now + timedelta(hours=1), now) is None
    assert br.cancel_violation({"cancel_before_hours": 0}, now + timedelta(hours=1), now) is None
    assert br.cancel_violation({"cancel_before_hours": 24}, now + timedelta(hours=5), now)
    assert br.cancel_violation({"cancel_before_hours": 24}, now + timedelta(hours=25), now) is None
