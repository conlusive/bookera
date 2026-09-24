import pytest


async def _salon(client, headers, services=2):
    r = await client.post("/crm/businesses", json={"name": "Nearest Salon", "city": "Львів"}, headers=headers)
    bid = r.json()["id"]
    ids = []
    for i in range(services):
        r = await client.post("/services", json={
            "business_id": bid, "name": f"Послуга {i}", "duration_minutes": 60, "price": 400,
        }, headers=headers)
        ids.append(r.json()["id"])
    await client.put(f"/crm/businesses/{bid}/hours", json=[
        {"weekday": d, "is_closed": False, "is_open": True, "open_time": "09:00", "close_time": "20:00"}
        for d in range(7)
    ], headers=headers)
    return bid, ids


@pytest.mark.asyncio
async def test_nearest_slot_for_every_service_in_one_request(client, auth_headers):
    """
    Один запит повертає найближче вікно для кожної послуги.

    Раніше сторінка салону робила це сама: до 168 послідовних
    HTTP-запитів при кожному відкритті.
    """
    bid, ids = await _salon(client, auth_headers("nearest-owner"), services=3)

    r = await client.get(f"/appointments/nearest-slots?business_id={bid}")
    assert r.status_code == 200, r.text
    data = r.json()

    for sid in ids:
        assert str(sid) in data, f"для послуги {sid} має знайтись вікно"
        # Формат «YYYY-MM-DDTHH:MM»
        assert len(data[str(sid)]) == 16 and data[str(sid)][10] == "T"


@pytest.mark.asyncio
async def test_nearest_slots_route_not_swallowed(client, auth_headers):
    """
    Маршрут /nearest-slots не має перехоплюватись маршрутом
    /{appointment_id}: інакше повернувся б 422 чи 404 замість даних.
    """
    bid, _ = await _salon(client, auth_headers("nearest-route"), services=1)
    r = await client.get(f"/appointments/nearest-slots?business_id={bid}")
    assert r.status_code == 200, f"маршрут перехоплено: {r.status_code} {r.text[:120]}"


@pytest.mark.asyncio
async def test_today_slots_for_many_businesses_in_one_request(client, auth_headers):
    """Слоти для кількох карток головної - одним запитом замість дванадцяти."""
    from datetime import timedelta
    from app.core.time_utils import local_now

    a, _ = await _salon(client, auth_headers("today-a"), services=1)
    b, _ = await _salon(client, auth_headers("today-b"), services=1)
    target = (local_now().date() + timedelta(days=1)).isoformat()

    r = await client.get(f"/appointments/today-slots?business_ids={a},{b}&target_date={target}")
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data[str(a)]) == 3 and len(data[str(b)]) == 3, "по три перші вільні години"
    assert all(len(t) == 5 and t[2] == ":" for t in data[str(a)]), "формат HH:MM"


@pytest.mark.asyncio
async def test_today_slots_rejects_garbage_ids(client):
    r = await client.get("/appointments/today-slots?business_ids=abc&target_date=2026-10-01")
    assert r.status_code == 400
