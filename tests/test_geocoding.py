import pytest

from app.services import geocoding
from app.services.geocoding import clean_address, geocode_address


@pytest.mark.parametrize("raw,want", [
    ("вул. Городоцька, 45, оф. 12", ("вулиця Городоцька", "45")),
    ("просп. Свободи 28А", ("проспект Свободи", "28А")),
    ("ТЦ Форум, вул. Під Дубом 7Б, 2 поверх", ("вулиця Під Дубом", "7Б")),
    ("вул. Під Голоском 12, під'їзд 3", ("вулиця Під Голоском", "12")),
    ("пл. Ринок 1/2", ("площа Ринок", "1/2")),
    ("б-р Лесі Українки 24, каб. 205", ("бульвар Лесі Українки", "24")),
])
def test_address_cleaned_for_search(raw, want):
    """Офіс, поверх, ТЦ прибираються; «вул.» розгортається; «Під Дубом» цілий."""
    assert clean_address(raw) == want


@pytest.mark.asyncio
async def test_tries_structured_then_freeform(monkeypatch):
    """
    Кілька спроб, від точної до загальної. Перша не знайшла - друга
    знаходить. Раніше була лише одна спроба «як є».
    """
    calls = []

    async def fake(params):
        calls.append(params)
        return None if len(calls) == 1 else (49.84, 24.03)

    monkeypatch.setattr(geocoding, "_nominatim", fake)
    found = await geocode_address("Львів", "вул. Городоцька, 45, оф. 12")
    assert found == (49.84, 24.03)
    assert "street" in calls[0] and calls[0]["street"] == "45 вулиця Городоцька"
    assert "оф" not in calls[1]["q"], "очищена адреса без офісу"


@pytest.mark.asyncio
async def test_no_city_no_search(monkeypatch):
    """Без міста знайшовся б хіба центр країни - точка, що вводить в оману."""
    async def boom(params):
        raise AssertionError("не мав шукати")
    monkeypatch.setattr(geocoding, "_nominatim", boom)
    assert await geocode_address(None, "Дорошенка 1") is None


@pytest.mark.asyncio
async def test_geocode_button_saves_coordinates(client, auth_headers, monkeypatch):
    async def fake(params):
        return (49.8443, 24.0264)
    monkeypatch.setattr(geocoding, "_nominatim", fake)

    h = auth_headers("geo-owner")
    bid = (await client.post("/crm/businesses", json={"name": "Geo", "city": "Львів"}, headers=h)).json()["id"]
    await client.patch(f"/crm/businesses/{bid}", json={"address": "Дорошенка 1"}, headers=h)
    r = await client.post(f"/crm/businesses/{bid}/geocode", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["latitude"] == pytest.approx(49.8443)


@pytest.mark.asyncio
async def test_geocode_foreign_business_forbidden(client, auth_headers):
    bid = (await client.post("/crm/businesses", json={"name": "Mine", "city": "Львів", "address": "Дорошенка 1"},
                             headers=auth_headers("geo-a"))).json()["id"]
    r = await client.post(f"/crm/businesses/{bid}/geocode", headers=auth_headers("geo-b"))
    assert r.status_code == 403
