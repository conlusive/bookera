"""Завдатки онлайн і виплати закладам (за мінусом комісії) - сценарії з тестовою оплатою."""
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

from tests.test_subscription import _make_platform_admin

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"


def _slot(days: int, hour: int) -> str:
    return (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=days)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    ).isoformat()


async def _salon(client, headers, name, deposit=200, price=1000):
    r = await client.post("/crm/businesses", json={"name": name, "city": "Львів"}, headers=headers)
    bid = r.json()["id"]
    await client.patch(f"/crm/businesses/{bid}", json={"payments_settings": {
        "require_deposit": True, "deposit_type": "fixed", "deposit_amount": deposit}}, headers=headers)
    r = await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 30, "price": price}, headers=headers)
    return bid, r.json()["id"]


async def _book(client, bid, sid, start, phone, session):
    await client.post("/appointments/lock", json={"business_id": bid, "service_id": sid, "start_time": start, "session_token": session})
    r = await client.post("/appointments", json={
        "business_id": bid, "service_id": sid, "start_time": start, "session_token": session,
        "client_name": "Клієнт", "client_phone": phone, "client_email": f"{session}@t.com",
    })
    assert r.status_code == 200, r.text
    return r.json()


async def _pay_deposit(client, appt):
    r = await client.post(f"/appointments/{appt['id']}/deposit/checkout", json={"token": appt["deposit_token"]})
    assert r.status_code == 200, r.text
    return r.json()


async def _manage_token_of(appt) -> str:
    """Токен керування є лише в листі клієнту, тож у тесті беремо його з бази."""
    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        return await conn.fetchval("SELECT manage_token FROM appointments WHERE id=$1", appt["id"])
    finally:
        await conn.close()


async def _set_payout_details(client, headers, bid):
    r = await client.put(f"/crm/businesses/{bid}/payout-details", json={"method": "card", "value": "4111 1111 1111 1111", "holder": "Іван"}, headers=headers)
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_booking_needs_deposit_and_payment_holds_it(client, auth_headers):
    h = auth_headers("dep-owner-1")
    bid, sid = await _salon(client, h, "Deposit Salon")
    appt = await _book(client, bid, sid, _slot(2, 9), "+380671110001", "d1")
    assert appt["deposit_status"] == "awaiting" and appt["deposit_due"] == 200.0
    assert appt["deposit_token"] and "manage_token" not in appt, "для оплати є окремий ключ, токен керування не віддається"

    paid = await _pay_deposit(client, appt)
    assert paid["paid"] is True and paid["amount"] == 200.0  # тестова оплата проходить одразу

    fin = (await client.get(f"/crm/businesses/{bid}/finance", headers=h)).json()
    assert fin["on_hold"] == 200.0 and fin["next_payout"] == 0.0, "до візиту платформа лише тримає гроші"

    again = await client.post(f"/appointments/{appt['id']}/deposit/checkout", json={"token": appt["deposit_token"]})
    assert again.status_code == 409, "двічі завдаток не сплачується"
    wrong = await client.post(f"/appointments/{appt['id']}/deposit/checkout", json={"token": "чужий"})
    assert wrong.status_code == 404


@pytest.mark.asyncio
async def test_unpaid_deposit_releases_the_slot(client, auth_headers):
    h = auth_headers("dep-owner-2")
    bid, sid = await _salon(client, h, "Expiry Salon")
    start = _slot(2, 9)
    appt = await _book(client, bid, sid, start, "+380671110002", "d2")
    conn = await asyncpg.connect(DB_URL_RAW)
    try:  # ніби минуло більше 15 хвилин
        await conn.execute("UPDATE appointments SET created_at = now() - interval '30 minutes' WHERE id = $1", appt["id"])
    finally:
        await conn.close()
    # будь-який наступний запис до закладу знімає прострочений
    other = await _book(client, bid, sid, start, "+380671110003", "d3")
    assert other["id"] != appt["id"] and other["deposit_status"] == "awaiting"


@pytest.mark.asyncio
async def test_cancel_refunds_and_no_show_keeps_deposit(client, auth_headers):
    h = auth_headers("dep-owner-3")
    bid, sid = await _salon(client, h, "Refund Salon")
    refunded = await _book(client, bid, sid, _slot(2, 9), "+380671110004", "d4")
    await _pay_deposit(client, refunded)
    kept = await _book(client, bid, sid, _slot(2, 11), "+380671110005", "d5")
    await _pay_deposit(client, kept)

    await client.post(f"/appointments/{refunded['id']}/cancel", json={"token": await _manage_token_of(refunded)})
    await client.patch(f"/appointments/{kept['id']}/status", json={"status": "no-show"}, headers=h)

    fin = (await client.get(f"/crm/businesses/{bid}/finance", headers=h)).json()
    assert fin["on_hold"] == 0.0, "повернутий завдаток не тримається"
    assert fin["ready_gross"] == 200.0, "завдаток за неявку лишається закладу й готовий до виплати"


@pytest.mark.asyncio
async def test_payout_deducts_commission_automatically(client, auth_headers):
    h = auth_headers("dep-owner-4")
    bid, sid = await _salon(client, h, "Payout Salon", deposit=500, price=1000)
    await _set_payout_details(client, h, bid)

    # новий клієнт з вітрини: завдаток 500, візит 1000 => комісія 100
    appt = await _book(client, bid, sid, _slot(2, 9), "+380671110006", "d6")
    await _pay_deposit(client, appt)
    await client.patch(f"/appointments/{appt['id']}/status", json={"status": "completed"}, headers=h)

    fin = (await client.get(f"/crm/businesses/{bid}/finance", headers=h)).json()
    assert fin["ready_gross"] == 500.0 and fin["commission_owed"] == 100.0
    assert fin["will_deduct"] == 100.0 and fin["next_payout"] == 400.0

    admin = auth_headers("dep-admin")
    await _make_platform_admin("dep-admin")
    run = await client.post("/platform/payouts/run", headers=admin)
    assert run.status_code == 200 and run.json()["created"] == 1

    fin = (await client.get(f"/crm/businesses/{bid}/finance", headers=h)).json()
    payout = fin["payouts"][0]
    assert payout["gross"] == 500.0 and payout["commission_offset"] == 100.0 and payout["amount"] == 400.0
    assert payout["status"] == "pending"
    assert fin["commission_owed"] == 0.0, "комісію вирахувано з виплати: окремо платити не треба"
    comm = (await client.get(f"/crm/businesses/{bid}/commissions", headers=h)).json()
    assert [c["status"] for c in comm] == ["paid"]

    again = await client.post("/platform/payouts/run", headers=admin)
    assert again.json()["created"] == 0, "повторний запуск не виплачує те саме двічі"

    listed = (await client.get("/platform/payouts", headers=admin)).json()
    assert listed[0]["details"]["value"] == "4111111111111111", "адміністратор платформи бачить реквізити для переказу"
    done = await client.post(f"/platform/payouts/{payout['id']}/paid", headers=admin)
    assert done.json()["status"] == "paid"


@pytest.mark.asyncio
async def test_payout_needs_details_and_admin_rights(client, auth_headers):
    h = auth_headers("dep-owner-5")
    bid, sid = await _salon(client, h, "NoDetails Salon", deposit=500)
    appt = await _book(client, bid, sid, _slot(2, 9), "+380671110007", "d7")
    await _pay_deposit(client, appt)
    await client.patch(f"/appointments/{appt['id']}/status", json={"status": "completed"}, headers=h)

    admin = auth_headers("dep-admin-2")
    await _make_platform_admin("dep-admin-2")
    assert (await client.post("/platform/payouts/run", headers=admin)).json()["created"] == 0, "без реквізитів виплати немає"

    fin = (await client.get(f"/crm/businesses/{bid}/finance", headers=h)).json()
    assert fin["has_payout_details"] is False and fin["ready_gross"] == 500.0, "гроші не губляться - чекають реквізитів"

    assert (await client.post("/platform/payouts/run", headers=h)).status_code in (401, 403), "виплати формує лише адмін платформи"
    bad = await client.put(f"/crm/businesses/{bid}/payout-details", json={"method": "card", "value": "123456"}, headers=h)
    assert bad.status_code in (400, 422)


@pytest.mark.asyncio
async def test_payout_details_are_not_public(client, auth_headers):
    h = auth_headers("dep-owner-6")
    bid, _ = await _salon(client, h, "Private Salon")
    await _set_payout_details(client, h, bid)
    slug = (await client.get(f"/crm/businesses/{bid}", headers=h)).json().get("slug")
    public = (await client.get(f"/businesses/{slug}")).text
    assert "4111" not in public and "payout_details" not in public
    fin = (await client.get(f"/crm/businesses/{bid}/finance", headers=h)).json()
    assert fin["payout_details"]["masked"] == "4111 **** 1111", "навіть власнику реквізити віддаються лише маскою"


@pytest.mark.asyncio
async def test_booking_requires_login(client, auth_headers):
    """Запис і резерв слота - лише для зареєстрованих: гість не може записати чужу пошту прямим запитом."""
    h = auth_headers("login-owner-1")
    bid, sid = await _salon(client, h, "Login Salon")
    body = {"business_id": bid, "service_id": sid, "start_time": _slot(2, 9), "session_token": "anon1"}
    anon = {"x-test-anon": "1"}
    assert (await client.post("/appointments/lock", json=body, headers=anon)).status_code == 401
    assert (await client.post("/appointments/unlock", json=body, headers=anon)).status_code == 401
    full = {**body, "client_name": "Гість", "client_phone": "+380671119090", "client_email": "g@t.com"}
    assert (await client.post("/appointments", json=full, headers=anon)).status_code == 401
    assert (await client.post("/appointments", json=full)).status_code == 200  # зареєстрований клієнт записується
