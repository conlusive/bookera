import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _salon_with_master(client, owner_headers, master_id):
    """Заклад, майстер у ньому й завершений візит на 1000 ₴."""
    bid = (await client.post("/crm/businesses", json={"name": "Pay Salon", "city": "Львів"}, headers=owner_headers)).json()["id"]
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute(
            "INSERT INTO users (id, email, role, is_active, created_at, business_id) VALUES ($1,$2,'master',true,now(),$3) "
            "ON CONFLICT (id) DO UPDATE SET business_id = $3", master_id, f"{master_id}@example.com", bid)
        sid = await conn.fetchval("INSERT INTO services (business_id, name, duration_minutes, price) VALUES ($1,'S',60,1000) RETURNING id", bid)
        st = local_now().replace(tzinfo=None, microsecond=0) - timedelta(days=1)
        await conn.execute(
            "INSERT INTO appointments (business_id, service_id, master_id, start_time, end_time, status, price, source) "
            "VALUES ($1,$2,$3,$4,$5,'completed',1000,'online')", bid, sid, master_id, st, st + timedelta(hours=1))
    finally:
        await conn.close()
    return bid


async def _due(client, headers, bid):
    return (await client.get(f"/crm/businesses/{bid}/payouts/due", headers=headers)).json()["due"]


@pytest.mark.asyncio
async def test_new_salon_asks_for_nothing(client, auth_headers):
    """
    Ваш випадок: салон щойно зареєстровано - і вже «пора платити».
    Тепер, поки оплату не налаштовано, нагадувань немає.
    """
    h = auth_headers("pay-owner-1")
    bid = await _salon_with_master(client, h, "pay-m-1")
    assert await _due(client, h, bid) == []


@pytest.mark.asyncio
async def test_owner_never_gets_salary(client, auth_headers):
    """Власник не платить зарплату сам собі - навіть із візитами й «налаштуваннями»."""
    h = auth_headers("pay-owner-2")
    bid = await _salon_with_master(client, h, "pay-m-2")
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("UPDATE users SET commission_rate=100, payout_period='weekly', pay_configured_at=now()-interval '10 days' WHERE id='pay-owner-2'")
    finally:
        await conn.close()
    assert all(d["staff_id"] != "pay-owner-2" for d in await _due(client, h, bid))
    r = await client.post(f"/crm/businesses/{bid}/staff/pay-owner-2/payouts", json={}, headers=h)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_configuring_pay_sets_start_and_first_due_after_full_period(client, auth_headers):
    """
    Власник налаштував оплату - точка відліку. Одразу нагадування немає;
    після повного періоду - є.
    """
    h = auth_headers("pay-owner-3")
    bid = await _salon_with_master(client, h, "pay-m-3")
    r = await client.patch("/crm/staff/pay-m-3", json={"commission_rate": 40, "payout_period": "weekly"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json().get("pay_configured_at"), "момент налаштування зафіксовано"
    assert await _due(client, h, bid) == [], "одразу після налаштування - не пора"

    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("UPDATE users SET pay_configured_at = now() - interval '8 days' WHERE id='pay-m-3'")
        st = local_now().replace(tzinfo=None, microsecond=0) - timedelta(days=2)
        await conn.execute(
            "INSERT INTO appointments (business_id, master_id, start_time, end_time, status, price, source) "
            "VALUES ($1,'pay-m-3',$2,$3,'completed',1000,'online')", bid, st, st + timedelta(hours=1))
    finally:
        await conn.close()
    due = await _due(client, h, bid)
    assert [d["staff_id"] for d in due] == ["pay-m-3"], "через тиждень - пора"


@pytest.mark.asyncio
async def test_payout_without_setup_rejected(client, auth_headers):
    h = auth_headers("pay-owner-4")
    bid = await _salon_with_master(client, h, "pay-m-4")
    r = await client.post(f"/crm/businesses/{bid}/staff/pay-m-4/payouts", json={}, headers=h)
    assert r.status_code == 409
