"""
Журнал дій: курсор, фільтри, лічильники, видимість і покриття подій.
"""
import asyncpg
import pytest

from app.core.time_utils import local_now

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


async def _setup(client, auth_headers, tag):
    h = auth_headers(f"aud-{tag}")
    bid = (await client.post("/crm/businesses", json={"name": "Журнал", "city": "Львів"}, headers=h)).json()["id"]
    return h, bid


async def _services(client, h, bid, n):
    for i in range(n):
        r = await client.post("/services", json={"business_id": bid, "name": f"Послуга {i}", "duration_minutes": 30, "price": 100 + i}, headers=h)
        assert r.status_code in (200, 201), r.text


async def _log(client, h, bid, **params):
    r = await client.get(f"/crm/businesses/{bid}/audit", params=params, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.asyncio
async def test_cursor_pages_have_no_gaps_or_repeats(client, auth_headers):
    h, bid = await _setup(client, auth_headers, "cur")
    await _services(client, h, bid, 7)
    seen, cursor = [], None
    for _ in range(10):
        page = await _log(client, h, bid, limit=3, **({"before_id": cursor} if cursor else {}))
        seen += [e["id"] for e in page["items"]]
        if not page["has_more"]:
            assert page["next_before_id"] is None
            break
        cursor = page["next_before_id"]
    assert len(seen) == len(set(seen)) >= 7, "жодної події двічі"
    assert seen == sorted(seen, reverse=True), "найновіші першими"
    assert len((await _log(client, h, bid, limit=200))["items"]) == len(seen)


@pytest.mark.asyncio
async def test_filters_search_and_period(client, auth_headers):
    h, bid = await _setup(client, auth_headers, "flt")
    await _services(client, h, bid, 2)
    await client.post("/crm/clients", json={"business_id": bid, "name": "Марія Коваль", "phone": "+380501234567"}, headers=h)

    only_clients = await _log(client, h, bid, category="clients")
    assert [e["action"] for e in only_clients["items"]] == ["client_created"]
    assert [e["category"] for e in (await _log(client, h, bid, category="services"))["items"]] == ["services", "services"]

    found = await _log(client, h, bid, q="коваль")
    assert len(found["items"]) == 1 and "Марія" in found["items"][0]["summary"], "пошук без урахування регістру"
    assert (await _log(client, h, bid, q="100%_нема"))["items"] == [], "символи % і _ шукаються буквально"
    who = (await _log(client, h, bid))["items"][0]["actor_name"]
    assert len((await _log(client, h, bid, q=who[:3]))["items"]) == 3, "пошук знаходить і за імʼям того, хто діяв"

    today = local_now().date()
    assert len((await _log(client, h, bid, date_from=str(today)))["items"]) == 3
    assert (await _log(client, h, bid, date_to=str(today.replace(year=today.year - 1))))["items"] == []

    me = (await _log(client, h, bid))["items"][0]["actor_id"]
    assert len((await _log(client, h, bid, actor_id=me))["items"]) == 3
    assert (await _log(client, h, bid, actor_id="nobody"))["items"] == []


@pytest.mark.asyncio
async def test_summary_counts_by_category_and_person(client, auth_headers):
    h, bid = await _setup(client, auth_headers, "sum")
    await _services(client, h, bid, 3)
    await client.post("/crm/clients", json={"business_id": bid, "name": "Клієнт", "phone": "+380509999999"}, headers=h)
    r = await client.get(f"/crm/businesses/{bid}/audit/summary", headers=h)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["total"] == 4 and s["by_category"]["services"] == 3 and s["by_category"]["clients"] == 1
    assert s["by_category"]["money"] == 0
    assert s["by_actor"][0]["count"] == 4 and s["by_actor"][0]["role"] == "owner"
    q = await client.get(f"/crm/businesses/{bid}/audit/summary", params={"q": "Клієнт"}, headers=h)
    assert q.json()["total"] == 1


@pytest.mark.asyncio
async def test_admin_does_not_see_owner_actions_in_summary_either(client, auth_headers):
    h, bid = await _setup(client, auth_headers, "vis")
    await _services(client, h, bid, 2)
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("INSERT INTO users (id, email, full_name, role, is_active, created_at, business_id) VALUES ('aud-adm','a@e.com','Ірина','admin',true,now(),$1)", bid)
        await conn.execute("INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at) VALUES ('aud-adm',$1,'admin',true,now())", bid)
    finally:
        await conn.close()
    adm = auth_headers("aud-adm", "admin")
    assert (await client.get(f"/crm/businesses/{bid}/audit/summary", headers=adm)).json()["total"] == 0
    assert (await _log(client, adm, bid))["items"] == []


@pytest.mark.asyncio
async def test_client_changes_are_logged_without_private_text(client, auth_headers):
    h, bid = await _setup(client, auth_headers, "cli")
    cid = (await client.post("/crm/clients", json={"business_id": bid, "name": "Ольга", "phone": "+380507777777"}, headers=h)).json()["id"]
    await client.patch(f"/crm/clients/{cid}", json={"phone": "+380508888888", "notes": "Таємна алергія на лак", "name": "Ольга"}, headers=h)
    upd = next(e for e in (await _log(client, h, bid, category="clients"))["items"] if e["action"] == "client_updated")
    assert "Телефон: +380507777777 → +380508888888" in upd["summary"]
    assert "Нотатки (змінено)" in upd["summary"] and "Таємна" not in upd["summary"] and "Таємна" not in str(upd["meta"])
    assert all(c["field"] != "name" for c in upd["meta"]["changes"]), "незмінене поле не потрапляє"
    await client.patch(f"/crm/clients/{cid}", json={"name": "Ольга"}, headers=h)
    assert sum(e["action"] == "client_updated" for e in (await _log(client, h, bid))["items"]) == 1, "без змін - без запису"
    # за клієнта з номером нараховано бали - його не видалити; видаляємо без номера
    gone = (await client.post("/crm/clients", json={"business_id": bid, "name": "Без номера"}, headers=h)).json()["id"]
    assert (await client.delete(f"/crm/clients/{gone}", headers=h)).status_code == 204
    last = (await _log(client, h, bid, category="clients"))["items"][0]
    assert last["action"] == "client_deleted" and "Без номера" in last["summary"]


@pytest.mark.asyncio
async def test_inventory_expense_campaign_and_goal_are_logged(client, auth_headers):
    h, bid = await _setup(client, auth_headers, "inv")
    item = (await client.post("/crm/inventory", json={"business_id": bid, "name": "Лак", "quantity": 10, "unit": "мл", "cost_per_unit": 20}, headers=h)).json()
    await client.patch(f"/crm/inventory/{item['id']}", json={"quantity": 7, "cost_per_unit": 25}, headers=h)
    exp = (await client.post("/crm/expenses", json={"business_id": bid, "category": "Оренда", "amount": 1000}, headers=h)).json()
    await client.patch(f"/crm/expenses/{exp['id']}", json={"amount": 1200}, headers=h)
    await client.delete(f"/crm/expenses/{exp['id']}", headers=h)
    await client.post("/crm/campaigns", json={"business_id": bid, "subject": "Новини", "message": "Текст розсилки для всіх", "audience": "all"}, headers=h)
    await client.put(f"/crm/businesses/{bid}/analytics/goal", json={"amount": 50000}, headers=h)

    by_action = {e["action"]: e["summary"] for e in (await _log(client, h, bid, limit=100))["items"]}
    assert "Залишок: 10 → 7" in by_action["item_updated"] and "Ціна за од., ₴: 20 → 25" in by_action["item_updated"]
    assert "Сума, ₴: 1000 → 1200" in by_action["expense_updated"]
    assert "1200" in by_action["expense_deleted"] or "1000" in by_action["expense_deleted"]
    assert "Розсилка «Новини»" in by_action["campaign_sent"]
    assert "50000" in by_action["goal_set"]
    cats = {e["action"]: e["category"] for e in (await _log(client, h, bid, limit=100))["items"]}
    assert cats["campaign_sent"] == "marketing" and cats["goal_set"] == "settings"


@pytest.mark.asyncio
async def test_pay_terms_change_is_logged_for_the_team(client, auth_headers):
    h, bid = await _setup(client, auth_headers, "pay")
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("INSERT INTO users (id, email, full_name, role, is_active, created_at, business_id, commission_rate) VALUES ('aud-m','m@e.com','Олена','master',true,now(),$1,30)", bid)
        await conn.execute("INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at) VALUES ('aud-m',$1,'master',true,now())", bid)
    finally:
        await conn.close()
    r = await client.patch(f"/crm/staff/aud-m?business_id={bid}", json={"commission_rate": 40}, headers=h)
    assert r.status_code == 200, r.text
    ev = next(e for e in (await _log(client, h, bid, category="team"))["items"] if e["action"] == "staff_updated")
    assert "Олена" in ev["summary"] and "Відсоток від виручки, %: 30 → 40" in ev["summary"]


@pytest.mark.asyncio
async def test_settings_changes_are_described_and_noops_are_not_logged(client, auth_headers):
    h, bid = await _setup(client, auth_headers, "set")
    base = (await _log(client, h, bid))["items"]
    r = await client.patch(f"/crm/businesses/{bid}", json={"notification_settings": {"auto_approve": False, "notify_client_booking": True}}, headers=h)
    assert r.status_code == 200, r.text
    ev = next(e for e in (await _log(client, h, bid, category="settings"))["items"] if e["action"] == "business_updated")
    assert "Авто-підтвердження записів" in ev["summary"] and "ні" in ev["summary"]
    n = len((await _log(client, h, bid, limit=100))["items"])

    # те саме значення вдруге - нічого не змінилось, запису немає
    await client.patch(f"/crm/businesses/{bid}", json={"notification_settings": {"auto_approve": False, "notify_client_booking": True}}, headers=h)
    assert len((await _log(client, h, bid, limit=100))["items"]) == n

    await client.patch(f"/crm/businesses/{bid}", json={"payments_settings": {"require_deposit": True, "deposit_type": "percent", "deposit_amount": 20}}, headers=h)
    summ = (await _log(client, h, bid, category="settings"))["items"][0]["summary"]
    assert "Передоплата" in summ and "Тип передоплати" in summ


@pytest.mark.asyncio
async def test_cover_photo_can_be_removed(client, auth_headers):
    h, bid = await _setup(client, auth_headers, "cover")
    r = await client.patch(f"/crm/businesses/{bid}", json={"cover_photo": "https://x.test/a.jpg"}, headers=h)
    assert r.status_code == 200 and r.json()["cover_photo"] == "https://x.test/a.jpg"
    r = await client.patch(f"/crm/businesses/{bid}", json={"cover_photo": None}, headers=h)
    assert r.status_code == 200 and r.json()["cover_photo"] is None


@pytest.mark.asyncio
async def test_address_change_moves_the_point_automatically(client, auth_headers, monkeypatch):
    calls = []

    async def fake_geocode(city, address):
        calls.append((city, address))
        return (50.45, 30.52) if "Київ" in (city or "") else (49.84, 24.03)

    monkeypatch.setattr("app.services.geocoding.geocode_address", fake_geocode)
    h, bid = await _setup(client, auth_headers, "geo")
    r = await client.patch(f"/crm/businesses/{bid}", json={"city": "Львів", "address": "Дорошенка 1"}, headers=h)
    assert (float(r.json()["latitude"]), float(r.json()["longitude"])) == (49.84, 24.03)

    # нова адреса без координат у запиті - точка переїжджає сама
    r = await client.patch(f"/crm/businesses/{bid}", json={"city": "Київ", "address": "Хрещатик 1"}, headers=h)
    assert (float(r.json()["latitude"]), float(r.json()["longitude"])) == (50.45, 30.52)

    # ручна мітка в тому ж запиті важливіша за пошук
    r = await client.patch(f"/crm/businesses/{bid}", json={"address": "Хрещатик 2", "latitude": 50.1, "longitude": 30.1}, headers=h)
    assert float(r.json()["latitude"]) == 50.1

    # адресу стерли - точки теж немає
    r = await client.patch(f"/crm/businesses/{bid}", json={"address": ""}, headers=h)
    assert r.json()["latitude"] is None
