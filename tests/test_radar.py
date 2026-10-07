"""
Радар: пакети, оплата (бали / картка), вплив на видачу, комісія.
Правила - у app/services/ranking.py.
"""
import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now, utc_now
from app.services import ranking

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _biz(client, headers, name="Радар-салон"):
    r = await client.post("/crm/businesses", json={"name": name, "city": "Львів", "category": "nails"}, headers=headers)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


async def _sql(query, *args):
    conn = await asyncpg.connect(DB)
    try:
        return await conn.fetch(query, *args)
    finally:
        await conn.close()


async def _give_points(business_id, points):
    await _sql("UPDATE businesses SET points_balance = $1 WHERE id = $2", points, business_id)


async def _set_quality(business_id, rating, reviews):
    await _sql("UPDATE businesses SET rating = $1, reviews_count = $2 WHERE id = $3", rating, reviews, business_id)


# ---------- правила ----------

def test_quality_prefers_many_good_reviews_over_a_single_five():
    assert ranking.quality_score(5.0, 80) > ranking.quality_score(5.0, 1)
    assert ranking.quality_score(5.0, 0) == ranking.quality_score(ranking.PRIOR_RATING, 0), "без відгуків рейтинг ніщо"
    assert ranking.quality_score(3.0, 100) == 0
    assert ranking.quality_score(5.0, 10_000) <= ranking.QUALITY_MAX


def test_weights_add_up_to_one_hundred():
    w = ranking.ranking_rules()["weights"]
    assert w["quality_max"] + w["proximity_max"] + w["free_slots"] + w["radar"] == 100


def test_radar_helps_but_never_decides():
    # слабкий (4.0, 3 відгуки) з Радаром не обходить помітно кращого (4.8, 90) без нього
    weak = ranking.rank_score(4.0, 3, True)
    strong = ranking.rank_score(4.8, 90, False)
    assert strong - weak > 8, "різниця в якості не перекривається Радаром"
    # рівних Радар піднімає
    assert ranking.rank_score(4.5, 30, True) > ranking.rank_score(4.5, 30, False)
    # максимум - RADAR_BONUS, мінімум - частка RADAR_QUALITY_FLOOR
    top = ranking.radar_points(5.0, 10_000)
    low = ranking.radar_points(3.0, 100)
    assert top == pytest.approx(ranking.RADAR_BONUS)
    assert low == pytest.approx(ranking.RADAR_BONUS * ranking.RADAR_QUALITY_FLOOR)


def test_longer_packages_are_cheaper_per_day():
    per_day = [p["per_day_uah"] for p in ranking.packages_view()]
    assert per_day == sorted(per_day, reverse=True)


# ---------- огляд і оплата ----------

@pytest.mark.asyncio
async def test_overview_lists_packages_and_affordability(client, auth_headers):
    h = auth_headers("radar-ov")
    bid = await _biz(client, h)
    await _give_points(bid, 150)
    r = await client.get(f"/crm/businesses/{bid}/radar", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["active"] is False and body["days_left"] == 0
    assert [p["days"] for p in body["packages"]] == [1, 3, 7, 14, 30, 90]
    assert [p["can_afford_points"] for p in body["packages"]] == [True, True, True, False, False, False]
    assert body["position"]["position_with_radar"] <= body["position"]["position_without_radar"]
    assert body["rules"]["weights"]["radar"] == ranking.RADAR_BONUS


@pytest.mark.asyncio
async def test_points_purchase_spends_exact_price_and_extends(client, auth_headers):
    h = auth_headers("radar-pts")
    bid = await _biz(client, h)
    await _give_points(bid, 500)

    r = await client.post(f"/crm/businesses/{bid}/radar/activate-with-points", json={"days": 7}, headers=h)
    assert r.status_code == 200, r.text
    first = r.json()
    assert first["active"] is True and first["points_balance"] == 500 - 100
    assert first["days_left"] == 7

    r = await client.post(f"/crm/businesses/{bid}/radar/activate-with-points", json={"days": 14}, headers=h)
    second = r.json()
    assert second["points_balance"] == 500 - 100 - 180
    assert second["days_left"] == 21, "нові дні додаються до кінця діючого пакета"
    assert len(second["history"]) == 2

    ledger = (await client.get(f"/crm/businesses/{bid}/points-ledger", headers=h)).json()
    assert sorted(e["amount"] for e in ledger if e["reason"] == "radar_purchase") == [-180, -100]


@pytest.mark.asyncio
async def test_points_purchase_needs_enough_points_and_a_real_package(client, auth_headers):
    h = auth_headers("radar-bad")
    bid = await _biz(client, h)
    await _give_points(bid, 99)
    r = await client.post(f"/crm/businesses/{bid}/radar/activate-with-points", json={"days": 7}, headers=h)
    assert r.status_code == 402
    await _give_points(bid, 1000)
    r = await client.post(f"/crm/businesses/{bid}/radar/activate-with-points", json={"days": 5}, headers=h)
    assert r.status_code == 400, "лише пакети 7 / 14 / 30"
    assert (await client.get(f"/crm/businesses/{bid}/radar", headers=h)).json()["points_balance"] == 1000


@pytest.mark.asyncio
async def test_card_checkout_activates_with_test_payment(client, auth_headers):
    h = auth_headers("radar-card")
    bid = await _biz(client, h)
    r = await client.post(f"/crm/businesses/{bid}/radar/checkout", json={"days": 14}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["activated"] is True and body["active"] is True and body["days_left"] == 14
    assert body["history"][0]["paid_with"] == "payment"
    assert body["history"][0]["amount_uah"] == 529
    rows = await _sql("SELECT status, amount, purpose FROM payments WHERE business_id = $1", bid)
    assert [(r["status"], float(r["amount"]), r["purpose"]) for r in rows] == [("completed", 529.0, "radar_boost")]


@pytest.mark.asyncio
async def test_provider_confirmation_grants_days_once(client, auth_headers):
    h = auth_headers("radar-wfp")
    bid = await _biz(client, h)
    order = f"rb-{bid}-7-abc123"
    await _sql(
        "INSERT INTO payments (business_id, purpose, amount, currency, provider, provider_ref, status) "
        "VALUES ($1, 'radar_boost', 299, 'UAH', 'wayforpay', $2, 'pending')", bid, order)
    body = {"orderReference": order, "transactionStatus": "Approved", "amount": "299.00"}
    for _ in range(2):
        r = await client.post("/payments/wayforpay/callback", json=body)
        assert r.status_code == 200, r.text
    boosts = await _sql("SELECT paid_with FROM radar_boosts WHERE business_id = $1", bid)
    assert len(boosts) == 1, "повторне підтвердження не нараховує вдруге"
    assert (await client.get(f"/crm/businesses/{bid}/radar", headers=h)).json()["days_left"] == 7


@pytest.mark.asyncio
async def test_master_cannot_spend_the_salons_money(client, auth_headers):
    h = auth_headers("radar-owner2")
    bid = await _biz(client, h)
    await _give_points(bid, 500)
    other = auth_headers("radar-stranger")
    for path in ("activate-with-points", "checkout"):
        r = await client.post(f"/crm/businesses/{bid}/radar/{path}", json={"days": 7}, headers=other)
        assert r.status_code in (403, 404), (path, r.status_code)
    assert (await client.get(f"/crm/businesses/{bid}/radar", headers=h)).json()["active"] is False


# ---------- видача ----------

@pytest.mark.asyncio
async def test_radar_lifts_a_place_but_not_above_clearly_better_ones(client, auth_headers):
    ids = {}
    for tag, rating, reviews in (("top", 4.9, 80), ("plain", 4.0, 30), ("boosted", 4.0, 30), ("weak", 3.5, 100)):
        h = auth_headers(f"rank-{tag}")
        ids[tag] = await _biz(client, h, name=f"Салон {tag}")
        await _set_quality(ids[tag], rating, reviews)
    await _give_points(ids["boosted"], 500)
    r = await client.post(f"/crm/businesses/{ids['boosted']}/radar/activate-with-points",
                          json={"days": 7}, headers=auth_headers("rank-boosted"))
    assert r.status_code == 200, r.text

    listing = (await client.get("/businesses/")).json()
    order = [b["id"] for b in listing]
    assert order.index(ids["top"]) < order.index(ids["boosted"]) < order.index(ids["plain"]), \
        "значно кращий заклад лишається вище, Радар піднімає над рівним"
    by_id = {b["id"]: b for b in listing}
    assert by_id[ids["boosted"]]["is_radar_active"] is True
    assert by_id[ids["boosted"]]["radar_bonus_km"] == ranking.RADAR_BONUS_KM
    assert by_id[ids["plain"]]["is_radar_active"] is False and by_id[ids["plain"]]["radar_bonus_km"] == 0
    assert by_id[ids["boosted"]]["rank_score"] - by_id[ids["plain"]]["rank_score"] == pytest.approx(ranking.radar_points(4.0, 30))

    r = await client.get(f"/crm/businesses/{ids['boosted']}/radar", headers=auth_headers("rank-boosted"))
    pos = r.json()["position"]
    assert pos["position"] < pos["position_without_radar"], "позиція з Радаром краща, ніж була б без нього"


@pytest.mark.asyncio
async def test_expired_boost_gives_no_advantage(client, auth_headers):
    h = auth_headers("rank-expired")
    bid = await _biz(client, h, name="Колишній Радар")
    await _sql(
        "INSERT INTO radar_boosts (business_id, started_at, expires_at, paid_with, points_spent, status) "
        "VALUES ($1, $2, $3, 'points', 100, 'active')", bid, utc_now() - timedelta(days=9), utc_now() - timedelta(days=2))
    listing = (await client.get("/businesses/")).json()
    mine = next(b for b in listing if b["id"] == bid)
    assert mine["is_radar_active"] is False and mine["radar_bonus_km"] == 0
    assert (await client.get(f"/crm/businesses/{bid}/radar", headers=h)).json()["active"] is False


@pytest.mark.asyncio
async def test_ranking_rules_endpoint_matches_the_service(client):
    r = await client.get("/businesses/ranking-rules")
    assert r.status_code == 200
    assert r.json() == ranking.ranking_rules()
    # радіус «поруч» (для «Дешевших» і «Рекомендованих») - окреме правило, ширше за радіус балів за близькість
    assert r.json()["nearby_radius_km"] == ranking.NEARBY_RADIUS_KM > ranking.PROXIMITY_RADIUS_KM


# ---------- комісія ----------

async def _appt(bid, source, price=1000, hours_ago=3):
    st = local_now().replace(tzinfo=None, microsecond=0) - timedelta(hours=hours_ago)
    rows = await _sql(
        "INSERT INTO appointments (business_id, client_name, start_time, end_time, status, price, source) "
        "VALUES ($1,'Марія',$2,$3,'confirmed',$4,$5) RETURNING id", bid, st, st + timedelta(hours=1), price, source)
    return rows[0]["id"]


@pytest.mark.asyncio
async def test_commission_only_for_storefront_clients_even_with_radar(client, auth_headers):
    h = auth_headers("radar-comm")
    bid = await _biz(client, h)
    await _give_points(bid, 500)
    await client.post(f"/crm/businesses/{bid}/radar/activate-with-points", json={"days": 7}, headers=h)

    direct = await _appt(bid, "direct")
    store = await _appt(bid, "marketplace", hours_ago=6)
    for appt in (direct, store):
        r = await client.patch(f"/crm/appointments/{appt}/status", json={"status": "completed"}, headers=h)
        assert r.status_code == 200, r.text

    commissions = (await client.get(f"/crm/businesses/{bid}/commissions", headers=h)).json()
    assert [c["appointment_id"] for c in commissions] == [store], "власні клієнти безкоштовні, і з Радаром теж"
    assert commissions[0]["reason"] == "marketplace_source"


# ---------- розсилки: підрахунок аудиторії ----------

@pytest.mark.asyncio
async def test_campaign_audience_counts_only_reachable_clients(client, auth_headers):
    h = auth_headers("radar-aud")
    bid = await _biz(client, h)
    for i, email in enumerate(["a@test.com", "b@test.com", None]):
        body = {"business_id": bid, "name": f"Клієнт {i}", "phone": f"+38067000{i:04d}"}
        if email:
            body["email"] = email
        r = await client.post("/crm/clients", json=body, headers=h)
        assert r.status_code in (200, 201), r.text

    r = await client.get("/crm/campaigns/audience", params={"business_id": bid}, headers=h)
    assert r.status_code == 200, r.text
    counts = r.json()
    assert counts["total_clients"] == 3 and counts["without_email"] == 1
    assert counts["all"] == 2, "лист піде лише тим, у кого є пошта"
    assert counts["regular"] == 0 and counts["lapsed"] == 0

    sent = await client.post("/crm/campaigns", json={
        "business_id": bid, "subject": "Привіт", "message": "Текст розсилки для клієнтів", "audience": "all"}, headers=h)
    assert sent.json()["queued"] == counts["all"], "число перед відправкою збігається з фактом"
