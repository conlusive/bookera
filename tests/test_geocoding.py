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


class _Resp:
    def __init__(self, data, status=200):
        self._d, self.status_code = data, status

    def json(self):
        return self._d


def _photon(features, captured=None):
    class C:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, url, params=None, headers=None):
            if captured is not None:
                captured.append(params)
            return _Resp({"features": features})
    return C


def _f(lat, lon, **props):
    return {"geometry": {"coordinates": [lon, lat]}, "properties": {"countrycode": "UA", **props}}


@pytest.mark.asyncio
async def test_suggest_labels_and_ukraine_only(monkeypatch):
    geocoding._suggest_cache.clear()
    feats = [
        _f(49.84, 24.01, street="вулиця Городоцька", housenumber="45", city="Львів"),
        {"geometry": {"coordinates": [21.0, 52.2]}, "properties": {"countrycode": "PL", "street": "Grodzka", "housenumber": "45"}},
        _f(49.84, 24.03, name="Top Barber", street="вулиця Дорошенка", housenumber="1", city="Львів"),
    ]
    monkeypatch.setattr(geocoding.httpx, "AsyncClient", _photon(feats))
    out = await geocoding.suggest_addresses("Городоцька 45", 49.84, 24.03)
    assert [o["title"] for o in out] == ["вулиця Городоцька, 45", "Top Barber · вулиця Дорошенка, 1"], "Польща відфільтрована"
    assert out[0]["subtitle"] == "Львів"
    assert out[0]["lat"] == 49.84 and out[0]["lng"] == 24.01, "координати не переплутані (Photon віддає lon, lat)"


@pytest.mark.asyncio
async def test_suggest_short_query_no_request(monkeypatch):
    """Менше 3 символів - нічого не шукаємо: підказки на «Го» марні."""
    geocoding._suggest_cache.clear()
    calls = []
    monkeypatch.setattr(geocoding.httpx, "AsyncClient", _photon([], calls))
    assert await geocoding.suggest_addresses("Го") == []
    assert calls == []


@pytest.mark.asyncio
async def test_suggest_cached(monkeypatch):
    """Той самий запит удруге - з кешу, без звернення до сервісу."""
    geocoding._suggest_cache.clear()
    calls = []
    monkeypatch.setattr(geocoding.httpx, "AsyncClient", _photon([_f(49.8, 24.0, street="вулиця Шевченка", housenumber="10")], calls))
    await geocoding.suggest_addresses("Шевченка 10", 49.8, 24.0)
    await geocoding.suggest_addresses("Шевченка 10", 49.8, 24.0)
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_suggest_route_requires_login(client, auth_headers, monkeypatch):
    geocoding._suggest_cache.clear()
    monkeypatch.setattr(geocoding.httpx, "AsyncClient", _photon([_f(49.8, 24.0, street="вулиця Шевченка", housenumber="10")]))
    assert (await client.get("/crm/businesses/geo/suggest", params={"q": "Шевченка 10"})).status_code in (401, 403)
    r = await client.get("/crm/businesses/geo/suggest", params={"q": "Шевченка 10"}, headers=auth_headers("geo-user"))
    assert r.status_code == 200, r.text
    assert r.json()[0]["title"] == "вулиця Шевченка, 10"
