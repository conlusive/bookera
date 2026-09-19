"""
Проставити координати закладам, які їх не мають.

Геокодування ввімкнулось не з першого дня, тому заклади, створені
раніше, лишились без координат — і не потрапляють у пошук «поруч
зі мною». Цей скрипт проходить базу й виправляє їх.

Запуск:
    python -m scripts.backfill_coordinates

Nominatim дозволяє один запит на секунду, тож сто закладів — це
близько двох хвилин. Скрипт можна перервати й запустити знову:
вже оброблені він пропускає.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models import Business
from app.services.geocoding import geocode_address


async def main() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Business).where(Business.latitude.is_(None))
        )
        businesses = result.scalars().all()

        if not businesses:
            print("Усі заклади вже мають координати.")
            return

        print(f"Без координат: {len(businesses)}. Це займе близько "
              f"{len(businesses)} секунд.\n")

        found_count = 0

        for i, business in enumerate(businesses, 1):
            label = f"{business.city or '?'}, {business.address or '?'}"
            coords = await geocode_address(business.city, business.address)

            if coords:
                business.latitude, business.longitude = coords
                found_count += 1
                print(f"  [{i}/{len(businesses)}] {business.name}: {label} → "
                      f"{coords[0]:.5f}, {coords[1]:.5f}")
            else:
                print(f"  [{i}/{len(businesses)}] {business.name}: {label} → не знайдено")

            # Зберігаємо ПОРЦІЯМИ, а не в кінці: на сотому закладі
            # скрипт може впасти через мережу, і втрачати роботу
            # дев'яноста дев'яти попередніх безглуздо.
            if i % 10 == 0:
                await db.commit()

        await db.commit()

        print(f"\nГотово. Знайдено координати: {found_count} із {len(businesses)}.")

        if found_count < len(businesses):
            print("\nДля решти адресу не вдалося розпізнати — найчастіше це")
            print("новобудови або нестандартний запис. Власники можуть")
            print("поставити мітку вручну в налаштуваннях закладу.")


if __name__ == "__main__":
    asyncio.run(main())
