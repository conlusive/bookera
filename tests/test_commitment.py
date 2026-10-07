"""Пакети Радара: короткі дорожчі за день, 90 днів - зобов'язання зі зниженою комісією за нового клієнта з вітрини."""
import asyncpg
import pytest

from app.services import ranking
from tests.test_traffic_split import _book_via_lock, _commissions, _salon, _slot

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


def test_packages_are_cheaper_per_day_and_only_the_long_one_is_a_commitment():
    view = ranking.packages_view()
    assert [p["days"] for p in view] == [1, 3, 7, 14, 30, 90]
    per_day = [p["per_day_uah"] for p in view]
    assert per_day == sorted(per_day, reverse=True)
    assert [p["days"] for p in view if p["commitment"]] == [90]
    assert view[-1]["commission_rate"] == 7.0 and view[0]["commission_rate"] is None


async def _boost(business_id, days):
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute(
            "INSERT INTO radar_boosts (business_id, started_at, expires_at, paid_with, status) "
            "VALUES ($1, now() - interval '1 day', now() + make_interval(days => $2), 'points', 'active')", business_id, days)
    finally:
        await conn.close()


async def _first_visit_commission(client, headers, business_id, service_id, day, session):
    appt = await _book_via_lock(client, business_id, service_id, _slot(day, 9), None, session)
    await client.patch(f"/appointments/{appt['id']}/status", json={"status": "completed"}, headers=headers)
    return (await _commissions(client, headers, business_id))[-1]


@pytest.mark.asyncio
async def test_commitment_lowers_the_commission_for_a_new_marketplace_client(client, auth_headers):
    h = auth_headers("commit-owner-1")
    bid, sid, _ = await _salon(client, h, "Commit Salon")
    await _boost(bid, 89)  # 90-денний пакет, що вже йде
    c = await _first_visit_commission(client, h, bid, sid, 2, "cm1")
    assert float(c["amount"]) == 70.0 and float(c["rate_applied"]) == 7.0


@pytest.mark.asyncio
async def test_short_boost_keeps_the_standard_commission(client, auth_headers):
    h = auth_headers("commit-owner-2")
    bid, sid, _ = await _salon(client, h, "Short Salon")
    await _boost(bid, 6)
    c = await _first_visit_commission(client, h, bid, sid, 2, "cm2")
    assert float(c["amount"]) == 100.0 and float(c["rate_applied"]) == 10.0
