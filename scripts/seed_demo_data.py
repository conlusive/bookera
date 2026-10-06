"""
Мінімальні демо-дані, щоб було що тестувати: 3 заклади з послугами, майстрами, годинами роботи, кількома клієнтами й записами.

ТІЛЬКИ ДОДАЄ (нічого не видаляє й не чистить) і безпечний до повторного запуску: заклад із таким slug пропускається.
Запуск (власник - ваш акаунт у системі, за email):

    DATABASE_URL=postgresql+asyncpg://... python scripts/seed_demo_data.py test@test.com

Адреса бази береться лише зі змінної середовища; скрипт друкує, до якої бази підключився.
"""
import asyncio
import os
import sys
from datetime import datetime, time as dtime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.models import Appointment, Business, Client, Service, StaffMembership, User  # noqa: E402
from app.models.business import BusinessHours  # noqa: E402

SALONS = [
    dict(slug="lotos", name="Студія Лотос", category="nails", city="Львів", address="вул. Шевченка 12", lat=49.8397, lon=24.0297,
         description="Манікюр і педикюр у затишній студії в центрі. Працюємо з преміальними матеріалами, стерильні інструменти.",
         services=[("Манікюр класичний", 600, 60), ("Манікюр + покриття", 750, 90), ("Педикюр", 800, 75)], deposit=200, master="Олена Мельник"),
    dict(slug="top-barber", name="Барбершоп Топ", category="barber", city="Львів", address="пл. Ринок 5", lat=49.8419, lon=24.0315,
         description="Чоловічі стрижки, оформлення бороди, гоління небезпечною бритвою.",
         services=[("Чоловіча стрижка", 500, 45), ("Борода", 300, 30), ("Стрижка + борода", 750, 75)], deposit=None, master="Іван Коваль"),
    dict(slug="brow-lab", name="Brow Lab", category="brows", city="Львів", address="вул. Городоцька 40", lat=49.8350, lon=24.0100,
         description="Брови та вії: ламінування, корекція, фарбування.",
         services=[("Корекція брів", 400, 40), ("Ламінування брів", 650, 60), ("Ламінування вій", 700, 75)], deposit=None, master="Софія Бондар"),
]


async def main(owner_email: str) -> None:
    url = os.environ["DATABASE_URL"]
    print("База:", url.split("@")[-1].split("/")[0], "/", url.rsplit("/", 1)[-1].split("?")[0])
    engine = create_async_engine(url, connect_args={"statement_cache_size": 0})
    S = async_sessionmaker(engine, expire_on_commit=False)
    async with S() as db:
        owner = (await db.execute(select(User).where(User.email == owner_email))).scalars().first()
        if not owner:
            sys.exit(f"Користувача {owner_email} немає в таблиці users: спершу увійдіть цим акаунтом на сайті")
        if owner.role != "business_owner":
            owner.role = "business_owner"  # щоб відкривався кабінет закладу
            print("Роль акаунта змінено на business_owner:", owner_email)

        tomorrow = (datetime.utcnow() + timedelta(days=1)).replace(minute=0, second=0, microsecond=0)
        for i, s in enumerate(SALONS):
            exists = (await db.execute(select(Business).where(Business.slug == s["slug"]))).scalars().first()
            if exists:
                print("Пропущено (вже є):", s["slug"])
                continue
            biz = Business(
                name=s["name"], slug=s["slug"], owner_id=owner.id, category=s["category"], city=s["city"], address=s["address"],
                latitude=s["lat"], longitude=s["lon"], description=s["description"], subscription_plan="active",
                direct_link_token=f"demo-{s['slug']}-link",
                payments_settings=({"require_deposit": True, "deposit_type": "fixed", "deposit_amount": s["deposit"]} if s["deposit"] else None),
            )
            db.add(biz)
            await db.flush()
            for wd in range(7):
                db.add(BusinessHours(business_id=biz.id, weekday=wd, is_open=wd < 6, open_time=dtime(9, 0), close_time=dtime(20, 0)))
            services = []
            for name, price, minutes in s["services"]:
                svc = Service(business_id=biz.id, name=name, price=price, duration_minutes=minutes)
                db.add(svc)
                services.append(svc)
            await db.flush()
            master_id = f"demo-master-{s['slug']}"
            db.add(User(id=master_id, email=f"{master_id}@demo.invalid", full_name=s["master"], role="master", business_id=biz.id,
                        assigned_services=[svc.id for svc in services], provides_services=True))
            await db.flush()
            db.add(StaffMembership(user_id=owner.id, business_id=biz.id, role="owner", is_active=True))
            db.add(StaffMembership(user_id=master_id, business_id=biz.id, role="master", is_active=True))
            for n, (cname, phone) in enumerate([("Марія Тестова", "+380671112233"), ("Ірина Коваль", "+380501234567")]):
                client = Client(business_id=biz.id, name=cname, phone=phone, email=None, tags=[])
                db.add(client)
                await db.flush()
                start = tomorrow.replace(hour=10 + n * 2)
                svc = services[n % len(services)]
                db.add(Appointment(business_id=biz.id, service_id=svc.id, master_id=master_id, client_id=client.id,
                                   start_time=start, end_time=start + timedelta(minutes=svc.duration_minutes), status="confirmed",
                                   price=svc.price, client_name=cname, client_phone=phone, source="manual"))
            if owner.business_id is None:
                owner.business_id = biz.id  # «поточний заклад»: саме його відкриває кабінет
            print("Додано:", s["name"], f"({len(services)} послуги, майстер {s['master']}, 2 записи на завтра)")
        await db.commit()
    await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Використання: DATABASE_URL=... python scripts/seed_demo_data.py <email власника>")
    asyncio.run(main(sys.argv[1]))
