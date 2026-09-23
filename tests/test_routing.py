"""
Відстань по дорогах - перевірка без мережі.

Маршрутизатор підміняється: так видно, що САМЕ ми йому шлемо і як
обробляємо відповідь. Помилка в порядку координат чи в одиницях
не падає з винятком - вона тихо дає неправильне число, і без цих
тестів її помітили б лише клієнти.
"""
import pytest

from app.services import routing
from app.services.routing import haversine_km, road_distances_km

OPERA = (49.8443, 24.0264)
HIGH_CASTLE = (49.8517, 24.0389)


class FakeResponse:
    def __init__(self, data, status=200):
        self._data = data
        self.status_code = status

    def json(self):
        return self._data


def fake_client(captured, data, status=200):
    class FakeClient:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url):
            captured.append(url)
            return FakeResponse(data, status)

    return FakeClient


@pytest.fixture(autouse=True)
def clear_cache():
    routing._cache.clear()
    yield
    routing._cache.clear()


@pytest.mark.asyncio
async def test_coordinates_sent_as_lng_lat(monkeypatch):
    """
    OSRM чекає «довгота,широта» - навпаки до звичного. Переплутаний
    порядок не дає помилки: маршрутизатор рахує маршрут до точки
    десь в Індійському океані й повертає правдоподібне велике число.
    """
    captured = []
    monkeypatch.setattr(routing.httpx, "AsyncClient",
                        fake_client(captured, {"distances": [[0, 1500.0]]}))

    await road_distances_km(OPERA[0], OPERA[1], [(1, HIGH_CASTLE[0], HIGH_CASTLE[1])])

    url = captured[0]
    assert f"{OPERA[1]},{OPERA[0]}" in url, "людина: спершу довгота, потім широта"
    assert f"{HIGH_CASTLE[1]},{HIGH_CASTLE[0]}" in url, "заклад: так само"
    assert "sources=0" in url, "відстань рахується від людини, а не між закладами"


@pytest.mark.asyncio
async def test_meters_converted_to_km(monkeypatch):
    """OSRM віддає метри. Забуте ділення на 1000 дало б «1500 км»."""
    monkeypatch.setattr(routing.httpx, "AsyncClient",
                        fake_client([], {"distances": [[0, 1523.4]]}))

    result = await road_distances_km(OPERA[0], OPERA[1], [(7, *HIGH_CASTLE)])
    assert result[7] == pytest.approx(1.5234)


@pytest.mark.asyncio
async def test_results_matched_to_right_business(monkeypatch):
    """
    Відповідь - масив у порядку запиту. Зсув на одиницю (перший
    елемент - відстань до себе, нуль) приписав би кожному закладу
    відстань сусіднього.
    """
    monkeypatch.setattr(routing.httpx, "AsyncClient",
                        fake_client([], {"distances": [[0, 800.0, 2400.0, 5100.0]]}))

    result = await road_distances_km(OPERA[0], OPERA[1], [
        (10, 49.845, 24.030),
        (20, 49.850, 24.040),
        (30, 49.860, 24.060),
    ])
    assert result == {10: 0.8, 20: 2.4, 30: 5.1}


@pytest.mark.asyncio
async def test_unreachable_business_is_skipped(monkeypatch):
    """
    Маршрут не знайдено (null) - заклад не отримує відстані, а не
    нуль. Нуль поставив би його першим як «найближчий».
    """
    monkeypatch.setattr(routing.httpx, "AsyncClient",
                        fake_client([], {"distances": [[0, None, 900.0]]}))

    result = await road_distances_km(OPERA[0], OPERA[1], [(1, 49.1, 24.1), (2, *HIGH_CASTLE)])
    assert 1 not in result
    assert result[2] == pytest.approx(0.9)


@pytest.mark.asyncio
async def test_router_down_returns_nothing_not_garbage(monkeypatch):
    """
    Маршрутизатор недоступний - порожній результат, а викликач
    підставить пряму відстань. Вигадане число гірше за приблизне.
    """
    monkeypatch.setattr(routing.httpx, "AsyncClient",
                        fake_client([], {}, status=503))

    result = await road_distances_km(OPERA[0], OPERA[1], [(1, *HIGH_CASTLE)])
    assert result == {}


@pytest.mark.asyncio
async def test_cache_distinguishes_nearby_people(monkeypatch):
    """
    Двоє людей за ~50 м одне від одного мають отримати різні відповіді.

    Раніше кеш округлював місце людини до ~110 м, і другий отримав би
    відстань першого - похибка до сотні метрів.
    """
    captured = []
    monkeypatch.setattr(routing.httpx, "AsyncClient",
                        fake_client(captured, {"distances": [[0, 1000.0]]}))

    await road_distances_km(49.84430, 24.02640, [(1, *HIGH_CASTLE)])
    await road_distances_km(49.84475, 24.02640, [(1, *HIGH_CASTLE)])  # ~50 м північніше

    assert len(captured) == 2, "друга людина має отримати власний маршрут, а не чужий із кешу"


@pytest.mark.asyncio
async def test_same_person_served_from_cache(monkeypatch):
    """Той самий запит удруге - з кешу, без звернення до маршрутизатора."""
    captured = []
    monkeypatch.setattr(routing.httpx, "AsyncClient",
                        fake_client(captured, {"distances": [[0, 1000.0]]}))

    await road_distances_km(OPERA[0], OPERA[1], [(1, *HIGH_CASTLE)])
    await road_distances_km(OPERA[0], OPERA[1], [(1, *HIGH_CASTLE)])
    assert len(captured) == 1


def test_straight_line_is_accurate():
    """
    Запасна відстань - гаверсинус. Опера - Високий замок: 1.22 км
    по прямій, перевірено за мапою.
    """
    assert haversine_km(*OPERA, *HIGH_CASTLE) == pytest.approx(1.22, abs=0.02)
