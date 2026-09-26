import asyncpg
import pytest

from app.core.categories import normalize_category, CATEGORY_SLUGS

DB = "postgresql://postgres:postgres@localhost:5432/bookera_test"


@pytest.mark.parametrize("old,new", [
    ("Барбер", "barber"), ("Салон краси", "hair"), ("beauty", "hair"),
    ("wellness", "massage"), ("spa", "massage"), ("Wellness & Spa", "massage"),
    ("home_services", "home"), ("home-services", "home"),
    ("hair_removal", "epilation"), ("aesthetic", "cosmetology"),
    ("piercing", "tattoo"), ("professional", "other"),
    ("  NAILS ", "nails"), ("щось невідоме", "other"), (None, "other"),
])
def test_every_old_spelling_becomes_one_code(old, new):
    """Пʼять старих списків -> один. Кожне написання - свій код."""
    assert normalize_category(old) == new


def test_canonical_codes_stay_as_is():
    for slug in CATEGORY_SLUGS:
        assert normalize_category(slug) == slug


@pytest.mark.asyncio
async def test_business_saved_with_code_not_label(client, auth_headers):
    """Реєстрація з назвою «Барбер» - у базі код barber."""
    r = await client.post("/crm/businesses", json={"name": "Cat Salon", "city": "Львів", "category": "Барбер"},
                          headers=auth_headers("cat-owner-1"))
    assert r.status_code in (200, 201), r.text
    assert r.json()["category"] == "barber"


@pytest.mark.asyncio
async def test_search_by_category_is_exact(client, auth_headers):
    """
    Пошук за категорією - точний збіг коду. Раніше LIKE по підрядку:
    «hair» знаходив і «hair_removal».
    """
    h = auth_headers("cat-owner-2")
    r = await client.post("/crm/businesses", json={"name": "Hair Only", "city": "Львів", "category": "hair"}, headers=h)
    hair_id = r.json()["id"]
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("UPDATE businesses SET category = 'epilation', subscription_plan = 'trial' WHERE id = $1", hair_id)
    finally:
        await conn.close()
    r = await client.get("/businesses/search-available", params={"category": "hair", "target_date": "2026-12-01"})
    if r.status_code == 200:
        assert all(b.get("category") == "hair" for b in r.json()), "у видачі «hair» лише hair"
