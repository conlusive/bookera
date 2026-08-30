"""
Найважливіший тест у всьому проєкті: перевіряє, що exclusion constraint
у базі даних реально не дає двом клієнтам забронювати той самий слот
одночасно. Це та сама "core IP", про яку йшлося в комерційних пропозиціях.
"""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest


async def _seed_business_with_master(client, headers):
    r = await client.post("/crm/businesses", json={"name": "Race Test Salon", "city": "Львів"}, headers=headers)
    assert r.status_code == 201, r.text
    business_id = r.json()["id"]

    r = await client.post(
        "/crm/businesses",  # dummy call just to ensure app import path warm - not used
        json={"name": "unused"}, headers=headers,
    )
    return business_id


@pytest.mark.asyncio
async def test_concurrent_locks_on_same_slot_only_one_succeeds(client, auth_headers):
    headers = auth_headers("race-owner")
    r = await client.post("/crm/businesses", json={"name": "Race Salon", "city": "Львів"}, headers=headers)
    business_id = r.json()["id"]

    r = await client.post(
        "/services", json={"business_id": business_id, "name": "Стрижка", "duration_minutes": 60, "price": 500},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    service_id = r.json()["id"]

    slot_start = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=1)).replace(
        hour=10, minute=0, second=0, microsecond=0
    )

    async def attempt(i: int):
        return await client.post(
            "/appointments/lock",
            json={
                "business_id": business_id,
                "service_id": service_id,
                "start_time": slot_start.isoformat(),
                "session_token": f"session-{i}",
            },
        )

    responses = await asyncio.gather(*[attempt(i) for i in range(15)], return_exceptions=True)
    codes = [r.status_code if not isinstance(r, Exception) else "ERROR" for r in responses]

    successes = codes.count(200)
    conflicts = codes.count(409)

    assert successes == 1, f"Очікував рівно 1 успішний lock, отримав {successes}. Коди: {codes}"
    assert conflicts == 14, f"Очікував 14 конфліктів (409), отримав {conflicts}. Коди: {codes}"


@pytest.mark.asyncio
async def test_service_from_another_business_is_rejected(client, auth_headers):
    """
    Регресійний тест на баг, знайдений вручну: /lock раніше не перевіряв,
    що service_id належить саме business_id з запиту.
    """
    headers = auth_headers("owner-a")
    r = await client.post("/crm/businesses", json={"name": "Salon A", "city": "Львів"}, headers=headers)
    business_a = r.json()["id"]

    headers_b = auth_headers("owner-b")
    r = await client.post("/crm/businesses", json={"name": "Salon B", "city": "Львів"}, headers=headers_b)
    business_b = r.json()["id"]

    r = await client.post(
        "/services", json={"business_id": business_b, "name": "Чужа послуга", "duration_minutes": 30, "price": 100},
        headers=headers_b,
    )
    service_from_b = r.json()["id"]

    slot_start = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=1)).replace(hour=12, minute=0)
    r = await client.post(
        "/appointments/lock",
        json={"business_id": business_a, "service_id": service_from_b, "start_time": slot_start.isoformat()},
    )
    assert r.status_code == 404, "Послуга іншого бізнесу має відхилятись, а не прийматись"
