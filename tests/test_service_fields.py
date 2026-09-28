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


@pytest.mark.asyncio
async def test_save_with_same_addons_no_conflict(client, auth_headers):
    """
    Ваш випадок: «Зберегти» з тими самими додатковими послугами падало 409
    (uq_service_addon) - старі зв'язки видалялись і вставлялись знову.
    """
    h = auth_headers("sf-owner4")
    bid = (await client.post("/crm/businesses", json={"name": "Addons", "city": "Львів"}, headers=h)).json()["id"]
    a1 = (await client.post("/services", json={"business_id": bid, "name": "Борода", "duration_minutes": 30, "price": 300}, headers=h)).json()["id"]
    a2 = (await client.post("/services", json={"business_id": bid, "name": "Камуфляж", "duration_minutes": 30, "price": 400}, headers=h)).json()["id"]
    main = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 600, "addon_service_ids": [a1]}, headers=h)).json()["id"]

    r = await client.patch(f"/services/{main}", json={"name": "Стрижка", "addon_service_ids": [a1]}, headers=h)
    assert r.status_code == 200, r.text
    r = await client.patch(f"/services/{main}", json={"addon_service_ids": [a1, a2]}, headers=h)
    assert sorted(r.json()["addon_service_ids"]) == sorted([a1, a2])
    r = await client.patch(f"/services/{main}", json={"addon_service_ids": [a2]}, headers=h)
    assert r.json()["addon_service_ids"] == [a2]


@pytest.mark.asyncio
async def test_addon_from_other_business_rejected(client, auth_headers):
    h = auth_headers("sf-owner5")
    bid = (await client.post("/crm/businesses", json={"name": "Mine", "city": "Львів"}, headers=h)).json()["id"]
    main = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 600}, headers=h)).json()["id"]
    o = auth_headers("sf-other")
    obid = (await client.post("/crm/businesses", json={"name": "Other", "city": "Львів"}, headers=o)).json()["id"]
    foreign = (await client.post("/services", json={"business_id": obid, "name": "Чужа", "duration_minutes": 30, "price": 1}, headers=o)).json()["id"]
    r = await client.patch(f"/services/{main}", json={"addon_service_ids": [foreign]}, headers=h)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_salon_page_shows_services_in_owner_order(client, auth_headers):
    """
    Порядок, налаштований власником, - той, що бачать клієнти. Раніше
    список ішов без впорядкування, і налаштування ні на що не впливало.
    """
    h = auth_headers("sf-owner6")
    r = await client.post("/crm/businesses", json={"name": "Order Salon", "city": "Львів"}, headers=h)
    bid, slug = r.json()["id"], r.json()["slug"]
    ids = [(await client.post("/services", json={"business_id": bid, "name": n, "duration_minutes": 30, "price": 100}, headers=h)).json()["id"]
           for n in ("Альфа", "Бета", "Гамма")]
    await client.put("/services/reorder", json={"business_id": bid, "ids": [ids[2], ids[0], ids[1]]}, headers=h)

    cab = [s["id"] for s in (await client.get(f"/services/business/{bid}", headers=h)).json()]
    assert cab == [ids[2], ids[0], ids[1]], "кабінет - у порядку власника"
    pub = await client.get(f"/businesses/{slug}")
    assert pub.status_code == 200, pub.text
    assert [s["id"] for s in pub.json()["services"]] == [ids[2], ids[0], ids[1]], "сторінка салону - так само"
