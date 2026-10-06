"""Публічні умови платформи для бізнес-лендінгу."""
from app.services.subscription import SUBSCRIPTION_PRICE_UAH, TRIAL_DAYS


async def test_platform_terms_are_public_and_match_code(client):
    r = await client.get("/businesses/platform-terms")
    assert r.status_code == 200
    data = r.json()
    assert data["price_uah"] == int(SUBSCRIPTION_PRICE_UAH)
    assert data["trial_days"] == TRIAL_DAYS
    assert data["period_days"] == 30
    assert data["marketplace_commission_percent"] == 10.0
    assert data["own_clients_commission_percent"] == 0
    assert "max-age" in r.headers.get("cache-control", "")
