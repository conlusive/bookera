import pytest


@pytest.mark.asyncio
async def test_description_category_saved_and_returned(client, auth_headers):
    """Опис і категорію форма показувала, але сервер не зберігав ніколи."""
    h = auth_headers("sf-owner")
    bid = (await client.post("/crm/businesses", json={"name": "Fields", "city": "Львів"}, headers=h)).json()["id"]
    r = await client.post("/services", json={
        "business_id": bid, "name": "Фарбування", "duration_minutes": 150, "price": 1800,
        "category": "  Фарбування  ", "description": "Тонування й догляд", "is_active": False,
    }, headers=h)
    assert r.status_code == 201, r.text
    s = r.json()
    assert (s["category"], s["description"], s["is_active"], s["duration_minutes"]) == ("Фарбування", "Тонування й догляд", False, 150)

    r = await client.patch(f"/services/{s['id']}", json={"category": "", "description": "Новий опис"}, headers=h)
    assert r.json()["category"] is None and r.json()["description"] == "Новий опис", "порожня категорія - без категорії"


@pytest.mark.asyncio
async def test_edit_keeps_addons_and_duration(client, auth_headers):
    """
    Раніше відкрити й зберегти послугу = тривалість 30 хв і стерті додаткові:
    форма читала duration/addon_services замість duration_minutes/addon_service_ids.
    Тут - що сервер віддає саме ті поля, які форма тепер читає.
    """
    h = auth_headers("sf-owner2")
    bid = (await client.post("/crm/businesses", json={"name": "Fields2", "city": "Львів"}, headers=h)).json()["id"]
    addon = (await client.post("/services", json={"business_id": bid, "name": "Борода", "duration_minutes": 30, "price": 300}, headers=h)).json()
    main = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 90, "price": 600, "addon_service_ids": [addon["id"]]}, headers=h)).json()
    assert main["duration_minutes"] == 90 and main["addon_service_ids"] == [addon["id"]]
    r = await client.patch(f"/services/{main['id']}", json={"name": "Стрижка чоловіча"}, headers=h)
    assert r.json()["duration_minutes"] == 90 and r.json()["addon_service_ids"] == [addon["id"]], "часткова зміна не чіпає решту"


@pytest.mark.asyncio
async def test_new_service_goes_last_and_reorder_in_one_call(client, auth_headers):
    h = auth_headers("sf-owner3")
    bid = (await client.post("/crm/businesses", json={"name": "Order", "city": "Львів"}, headers=h)).json()["id"]
    ids = []
    for n in ("Перша", "Друга", "Третя"):
        ids.append((await client.post("/services", json={"business_id": bid, "name": n, "duration_minutes": 30, "price": 100}, headers=h)).json()["id"])
    listed = (await client.get(f"/services/business/{bid}", headers=h)).json()
    by = {s["id"]: s["order_index"] for s in listed}
    assert by[ids[0]] < by[ids[1]] < by[ids[2]], "нова - в кінець"

    r = await client.put("/services/reorder", json={"business_id": bid, "ids": [ids[2], ids[0], ids[1]]}, headers=h)
    assert r.status_code == 200, r.text
    by = {s["id"]: s["order_index"] for s in (await client.get(f"/services/business/{bid}", headers=h)).json()}
    assert by[ids[2]] < by[ids[0]] < by[ids[1]]
    other = auth_headers("sf-stranger")
    assert (await client.put("/services/reorder", json={"business_id": bid, "ids": ids}, headers=other)).status_code == 403
