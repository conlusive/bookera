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
