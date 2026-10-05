import pytest


@pytest.mark.asyncio
async def test_public_business_detail_hides_internal_settings(client, auth_headers):
    owner = auth_headers("priv-owner")
    created = await client.post("/crm/businesses", json={"name": "Private Settings", "city": "Львів"}, headers=owner)
    bid, slug = created.json()["id"], created.json()["slug"]
    r = await client.patch(f"/crm/businesses/{bid}", json={
        "security_settings": {"pin": "secret-pin"},
        "payments_settings": {"iban": "UA00SECRET"},
        "notification_settings": {"email": True},
    }, headers=owner)
    assert r.status_code == 200, r.text

    # гість і сторонній користувач - без внутрішніх полів
    for headers in ({}, auth_headers("priv-stranger", "client")):
        pub = (await client.get(f"/businesses/{slug}", headers=headers)).json()
        for field in ("security_settings", "payments_settings", "notification_settings", "owner_id"):
            assert pub.get(field) is None, (field, pub.get(field))
        assert pub["name"] == "Private Settings"  # решта сторінки працює

    # власник бачить усе
    mine = (await client.get(f"/businesses/{slug}", headers=owner)).json()
    assert mine["payments_settings"] == {"iban": "UA00SECRET"}
    assert mine["owner_id"] == "priv-owner"
