import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _visit(client, headers, status="completed"):
    """Заклад, послуга й запис - з потрібним статусом і токеном."""
    r = await client.post("/crm/businesses", json={"name": "Review Salon", "city": "Львів"}, headers=headers)
    bid = r.json()["id"]
    r = await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 400}, headers=headers)
    sid = r.json()["id"]
    start = local_now().replace(tzinfo=None, microsecond=0) - timedelta(days=2)
    conn = await asyncpg.connect(DB)
    try:
        aid = await conn.fetchval(
            """INSERT INTO appointments (business_id, service_id, start_time, end_time, status,
                                         client_name, client_email, manage_token, source)
               VALUES ($1, $2, $3, $4, $5, 'Марія', 'maria@example.com', $6, 'online')
               RETURNING id""",
            bid, sid, start, start + timedelta(hours=1), status, f"tok-{bid}",
        )
    finally:
        await conn.close()
    return bid, aid, f"tok-{bid}"


@pytest.mark.asyncio
async def test_review_updates_business_rating(client, auth_headers):
    """
    Відгук зберігається й перераховує рейтинг закладу.
    Раніше рейтинг не оновлювало ніщо - він стояв на типовому значенні.
    """
    bid, aid, token = await _visit(client, auth_headers("rev-ok"))
    r = await client.post(f"/appointments/{aid}/review", json={"token": token, "rating": 4, "comment": "Добре"})
    assert r.status_code == 200, r.text
    assert r.json()["reviews_count"] == 1
    assert float(r.json()["rating"]) == 4.0


@pytest.mark.asyncio
async def test_cannot_review_twice(client, auth_headers):
    bid, aid, token = await _visit(client, auth_headers("rev-twice"))
    await client.post(f"/appointments/{aid}/review", json={"token": token, "rating": 5})
    r = await client.post(f"/appointments/{aid}/review", json={"token": token, "rating": 1})
    assert r.status_code == 409, "другий відгук на той самий візит - заборонено"


@pytest.mark.asyncio
async def test_cannot_review_without_visit(client, auth_headers):
    """Візит ще не відбувся - оцінювати нема що."""
    bid, aid, token = await _visit(client, auth_headers("rev-future"), status="confirmed")
    r = await client.post(f"/appointments/{aid}/review", json={"token": token, "rating": 5})
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_cannot_review_someone_elses_visit(client, auth_headers):
    """Без правильного токена - ніби візиту немає: 404, а не підказка."""
    bid, aid, token = await _visit(client, auth_headers("rev-alien"))
    r = await client.post(f"/appointments/{aid}/review", json={"token": "чужий", "rating": 5})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_rating_out_of_range_rejected(client, auth_headers):
    bid, aid, token = await _visit(client, auth_headers("rev-range"))
    for bad in (0, 6):
        r = await client.post(f"/appointments/{aid}/review", json={"token": token, "rating": bad})
        assert r.status_code == 400


@pytest.mark.asyncio
async def test_anonymous_public_review_is_closed(client, auth_headers):
    """
    Відкритий маршрут закрито: без входу й без візиту - жодних відгуків.
    Раніше будь-хто міг засипати будь-який заклад будь-якими оцінками.
    """
    r = await client.post("/crm/businesses", json={"name": "Target", "city": "Львів"}, headers=auth_headers("rev-target"))
    bid = r.json()["id"]
    r = await client.post("/public/reviews", json={"business_id": bid, "rating": 1, "author_name": "Конкурент"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_master_rating_and_review_master_are_public(client, auth_headers):
    """На сторінці салону видно рейтинг кожного майстра і кому адресований відгук."""
    bid, aid, token = await _visit(client, auth_headers("rev-master"))
    conn = await asyncpg.connect(DB)
    try:
        uid = await conn.fetchval("SELECT id FROM users WHERE business_id = $1", bid)
        await conn.execute("UPDATE appointments SET master_id = $1 WHERE id = $2", uid, aid)
    finally:
        await conn.close()
    r = await client.post(f"/appointments/{aid}/review", json={"token": token, "rating": 4, "master_rating": 5, "comment": "Чудово"})
    assert r.status_code == 200, r.text

    masters = (await client.get(f"/crm/businesses/{bid}/masters")).json()
    me = next(m for m in masters if m["id"] == uid)
    assert me["rating"] == 5.0 and me["reviews_count"] == 1

    reviews = (await client.get("/public/reviews", params={"business_id": bid})).json()
    assert reviews[0]["master_id"] == uid


async def _set(sql, *args):
    conn = await asyncpg.connect(DB)
    try:
        return await conn.fetchval(sql, *args)
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_manual_visit_cannot_be_reviewed(client, auth_headers):
    """Візит, який вніс у календар сам заклад, - не підстава для відгуку."""
    bid, aid, token = await _visit(client, auth_headers("rev-manual"))
    await _set("UPDATE appointments SET source = 'manual' WHERE id = $1 RETURNING id", aid)
    r = await client.post(f"/appointments/{aid}/review", json={"token": token, "rating": 5})
    assert r.status_code == 403, r.text


@pytest.mark.asyncio
async def test_owner_cannot_review_own_business(client, auth_headers):
    """Власник «записався» на власний заклад - відгук не приймається."""
    bid, aid, token = await _visit(client, auth_headers("rev-owner"))
    email = await _set("SELECT email FROM users WHERE business_id = $1", bid)
    assert email
    await _set("UPDATE appointments SET client_email = $1 WHERE id = $2 RETURNING id", email, aid)
    r = await client.post(f"/appointments/{aid}/review", json={"token": token, "rating": 5})
    assert r.status_code == 403, r.text
    assert "власний заклад" in r.json()["detail"]


@pytest.mark.asyncio
async def test_same_person_cannot_stack_reviews(client, auth_headers):
    """Дві візити однієї людини поспіль - лише один відгук за період."""
    bid, aid, token = await _visit(client, auth_headers("rev-stack"))
    r = await client.post(f"/appointments/{aid}/review", json={"token": token, "rating": 5})
    assert r.status_code == 200, r.text
    start = local_now().replace(tzinfo=None, microsecond=0) - timedelta(days=1)
    aid2 = await _set(
        """INSERT INTO appointments (business_id, service_id, start_time, end_time, status,
                                     client_name, client_email, manage_token, source)
           SELECT business_id, service_id, $2, $3, 'completed', 'Марія', 'maria@example.com', 'tok2-x', 'online'
           FROM appointments WHERE id = $1 RETURNING id""",
        aid, start, start + timedelta(hours=1),
    )
    r = await client.post(f"/appointments/{aid2}/review", json={"token": "tok2-x", "rating": 5})
    assert r.status_code == 403, r.text
