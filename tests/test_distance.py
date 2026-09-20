import asyncpg
import pytest
from datetime import timedelta

from app.core.time_utils import local_now

DB_URL_RAW = "postgresql://postgres:postgres@localhost:5432/bookera_test"

# Орієнтири у Львові - реальні координати, щоб відстані були
# перевіряними на мапі, а не вигаданими.
OPERA = (49.8443, 24.0264)          # Оперний театр, центр
HIGH_CASTLE = (49.8517, 24.0389)    # Високий замок, ~1.2 км від опери
SYHIV = (49.7856, 24.0489)          # Сихів, ~6.7 км від опери


async def _salon_at(client, headers, name, coords=None):
    r = await client.post("/crm/businesses", json={"name": name, "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.post("/services", json={
        "business_id": business_id, "name": "Стрижка", "duration_minutes": 60, "price": 400,
    }, headers=headers)

    await client.put(f"/crm/businesses/{business_id}/hours", json=[
        {"weekday": d, "is_closed": False, "is_open": True,
         "open_time": "09:00", "close_time": "20:00"} for d in range(7)
    ], headers=headers)

    if coords:
        conn = await asyncpg.connect(DB_URL_RAW)
        try:
            await conn.execute(
                "UPDATE businesses SET latitude = $1, longitude = $2 WHERE id = $3",
                coords[0], coords[1], business_id,
            )
        finally:
            await conn.close()

    return business_id


@pytest.mark.asyncio
async def test_results_sorted_by_distance(client, auth_headers):
    """
    Головне, заради чого все це: людина обирає послугу й бачить
    найближчі заклади першими.

    Без координат «поблизу» було б обманом - підпис каже «поруч»,
    а порядок випадковий.
    """
    far = await _salon_at(client, auth_headers("dist-far"), "Далекий салон", SYHIV)
    near = await _salon_at(client, auth_headers("dist-near"), "Близький салон", HIGH_CASTLE)

    target = (local_now().date() + timedelta(days=2)).isoformat()
    r = await client.get(
        f"/businesses/search-available?city=Львів&target_date={target}"
        f"&near_lat={OPERA[0]}&near_lng={OPERA[1]}"
    )
    assert r.status_code == 200, r.text

    ids = [b["id"] for b in r.json()]
    assert near in ids and far in ids, "обидва заклади мають бути в результатах"
    assert ids.index(near) < ids.index(far), "ближчий має бути першим"


@pytest.mark.asyncio
async def test_distance_is_accurate(client, auth_headers):
    """
    Відстань рахується за гаверсинусом.

    Спрощені формули («навпростець» по різниці координат) на широті
    України дають помилку до 40%: градус довготи там коротший за
    градус широти приблизно в 1.5 раза.
    """
    business_id = await _salon_at(client, auth_headers("dist-acc"), "Замок", HIGH_CASTLE)

    target = (local_now().date() + timedelta(days=2)).isoformat()
    r = await client.get(
        f"/businesses/search-available?city=Львів&target_date={target}"
        f"&near_lat={OPERA[0]}&near_lng={OPERA[1]}"
    )
    found = next(b for b in r.json() if b["id"] == business_id)

    # Реальна відстань опера - Високий замок приблизно 1.2 км
    assert found["distance_km"] is not None
    assert 0.9 < found["distance_km"] < 1.6, f"очікували ~1.2 км, отримали {found['distance_km']}"


@pytest.mark.asyncio
async def test_business_without_coords_goes_last(client, auth_headers):
    """
    Заклади без мітки йдуть у КІНЕЦЬ, а не на початок.

    Показувати їх першими означало б обманювати: ми не знаємо, де
    вони, і не можемо стверджувати, що вони поруч.
    """
    no_coords = await _salon_at(client, auth_headers("dist-none"), "Без мітки")
    with_coords = await _salon_at(client, auth_headers("dist-some"), "З міткою", SYHIV)

    target = (local_now().date() + timedelta(days=2)).isoformat()
    r = await client.get(
        f"/businesses/search-available?city=Львів&target_date={target}"
        f"&near_lat={OPERA[0]}&near_lng={OPERA[1]}"
    )
    ids = [b["id"] for b in r.json()]
    assert ids.index(with_coords) < ids.index(no_coords)

    found = next(b for b in r.json() if b["id"] == no_coords)
    assert found["distance_km"] is None, "для закладу без мітки відстані немає"


@pytest.mark.asyncio
async def test_without_point_order_unchanged(client, auth_headers):
    """
    Без координат людини сортування не втручається.

    Людина могла не дати доступ до геолокації - тоді порядок лишається
    таким, як був, а не стає випадковим.
    """
    await _salon_at(client, auth_headers("dist-plain-a"), "Салон А", SYHIV)
    await _salon_at(client, auth_headers("dist-plain-b"), "Салон Б", HIGH_CASTLE)

    target = (local_now().date() + timedelta(days=2)).isoformat()
    r = await client.get(f"/businesses/search-available?city=Львів&target_date={target}")
    assert r.status_code == 200, r.text

    for b in r.json():
        assert b["distance_km"] is None, "без точки відстань не рахується"


@pytest.mark.asyncio
async def test_manual_coords_not_overwritten_by_geocoding(client, auth_headers):
    """
    Ручна мітка НЕ перетирається геокодуванням.

    Власник міг поставити точку на вході з двору, а геокодер вказує
    на фасад. Перезаписувати його роботу автоматикою - неповага до
    зусиль, які він уже доклав.
    """
    headers = auth_headers("geo-manual-owner")
    r = await client.post("/crm/businesses", json={"name": "Ручна мітка", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    # Власник ставить мітку сам і одночасно міняє адресу
    r = await client.patch(f"/crm/businesses/{business_id}", json={
        "address": "Личаківська 45",
        "latitude": HIGH_CASTLE[0],
        "longitude": HIGH_CASTLE[1],
    }, headers=headers)
    assert r.status_code == 200, r.text

    conn = await asyncpg.connect(DB_URL_RAW)
    try:
        row = await conn.fetchrow(
            "SELECT latitude, longitude FROM businesses WHERE id = $1", business_id
        )
    finally:
        await conn.close()

    assert abs(float(row["latitude"]) - HIGH_CASTLE[0]) < 0.0001, \
        "ручна мітка має лишитись недоторканою"


@pytest.mark.asyncio
async def test_distances_endpoint_falls_back_to_straight_line(client, auth_headers):
    """
    Маршрутизатор недоступний - віддаємо пряму відстань із позначкою.

    Показати приблизне краще, ніж нічого: людина все одно розуміє
    порядок «поруч чи далеко», а знак «~» у картці каже, наскільки
    числу можна вірити.
    """
    headers = auth_headers("dist-endpoint-owner")
    business_id = await _salon_at(client, headers, "Endpoint Salon", HIGH_CASTLE)

    r = await client.post("/businesses/distances", json={
        "lat": OPERA[0], "lng": OPERA[1], "business_ids": [business_id],
    })
    assert r.status_code == 200, r.text

    data = r.json()
    entry = data[str(business_id)]

    # У тестах мережі до маршрутизатора немає, тож очікуємо пряму
    assert entry["km"] > 0
    assert 0.9 < entry["km"] < 1.6, f"пряма опера-замок ~1.2 км, отримали {entry['km']}"
    assert "is_road" in entry, "клієнт має знати, чи це маршрут"


@pytest.mark.asyncio
async def test_distances_endpoint_skips_business_without_coords(client, auth_headers):
    """Заклад без координат просто не потрапляє у відповідь."""
    headers = auth_headers("dist-endpoint-none")
    business_id = await _salon_at(client, headers, "No Coords Salon")

    r = await client.post("/businesses/distances", json={
        "lat": OPERA[0], "lng": OPERA[1], "business_ids": [business_id],
    })
    assert r.status_code == 200, r.text
    assert str(business_id) not in r.json()
