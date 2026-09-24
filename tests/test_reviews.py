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
