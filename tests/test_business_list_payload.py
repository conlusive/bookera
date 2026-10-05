import pytest

HIDDEN = {"security_settings", "notification_settings", "payments_settings", "layout_config", "workplace_photos", "owner_id"}


@pytest.mark.asyncio
async def test_public_list_does_not_expose_internal_settings(client, auth_headers):
    h = auth_headers("payload-owner")
    created = await client.post("/crm/businesses", json={"name": "Payload", "city": "Львів"}, headers=h)
    assert created.status_code == 201, created.text
    bid = created.json()["id"]

    listing = (await client.get("/businesses/?limit=10")).json()
    mine = next(b for b in listing if b["id"] == bid)
    assert not (HIDDEN & set(mine)), f"у списку є внутрішні поля: {HIDDEN & set(mine)}"
    # те, чим користується картка каталогу, на місці
    for key in ("id", "slug", "name", "rating", "reviews_count", "services", "working_hours", "rank_score", "is_radar_active"):
        assert key in mine, key

    # повна картка закладу, як і раніше, віддає все (її читає сторінка закладу)
    full = (await client.get(f"/businesses/{bid}")).json()
    assert "layout_config" in full and "workplace_photos" in full
