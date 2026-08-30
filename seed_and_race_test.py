"""
Реальний тест на конкурентність: 15 одночасних запитів на ОДИН і той самий
слот у одного майстра. Правильна поведінка - рівно 1 успіх, решта - 409.
Запускати: DATABASE_URL=... python3 seed_and_race_test.py
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.models import Base, Business, User, Service, RoleEnum, Appointment

DB_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/bookera_test")


async def seed():
    engine = create_async_engine(DB_URL)
    Session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as s:
        await s.execute(delete(Appointment))
        await s.execute(delete(Service))
        await s.execute(delete(User))
        await s.execute(delete(Business))
        await s.commit()

        biz = Business(name="Test Salon", slug="test-salon", city="Львів")
        s.add(biz)
        await s.flush()

        master = User(id="master-1", email="master1@test.com", role="master", business_id=biz.id)
        s.add(master)

        service = Service(business_id=biz.id, name="Стрижка", price=500, duration_minutes=60, order_index=0)
        s.add(service)
        await s.commit()
        await s.refresh(biz)
        await s.refresh(service)
        result = {"business_id": biz.id, "service_id": service.id, "master_id": "master-1"}
    await engine.dispose()
    return result


async def race_test(ids):
    from httpx import AsyncClient, ASGITransport
    from main import app

    slot_start = (datetime.utcnow() + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "business_id": ids["business_id"],
            "service_id": ids["service_id"],
            "start_time": slot_start.isoformat(),
            "master_id": ids["master_id"],
            "session_token": None,
        }

        async def attempt(i):
            p = dict(payload)
            p["session_token"] = f"session-{i}"
            r = await client.post("/appointments/lock", json=p)
            return r.status_code

        raw_results = await asyncio.gather(*[attempt(i) for i in range(15)], return_exceptions=True)

    results = [r if isinstance(r, int) else f"ERROR:{type(r).__name__}" for r in raw_results]
    success = sum(1 for r in results if r == 200)
    print(f"Статус-коди: {sorted(results)}")
    print(f"Успішних locks (200): {success}  |  Відхилено: {len(results) - success}")
    if success == 1:
        print("✅ РЕЗУЛЬТАТ: подвійне бронювання НЕ відбулось (рівно 1 успіх)")
    else:
        print(f"❌ РЕЗУЛЬТАТ: ПОДВІЙНЕ БРОНЮВАННЯ! {success} запитів отримали успішний lock на той самий слот")


async def main():
    ids = await seed()
    await race_test(ids)


if __name__ == "__main__":
    asyncio.run(main())
