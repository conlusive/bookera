"""
Показати, у яких закладів є координати.

Швидка перевірка перед тим, як шукати проблему деінде: якщо
координат немає, пошук «поблизу» не працюватиме, скільки не
дивись у браузер.

Запуск:
    python scripts/check_coordinates.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models import Business


async def main() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Business).order_by(Business.id))
        businesses = result.scalars().all()

        if not businesses:
            print("У базі немає жодного закладу.")
            return

        with_coords = 0

        print(f"{'Заклад':<28} {'Адреса':<34} Координати")
        print("-" * 86)

        for b in businesses:
            address = f"{b.city or '?'}, {b.address or '?'}"
            if b.latitude is not None and b.longitude is not None:
                coords = f"{float(b.latitude):.5f}, {float(b.longitude):.5f}"
                with_coords += 1
            else:
                coords = "— НЕМАЄ"

            print(f"{(b.name or '?')[:27]:<28} {address[:33]:<34} {coords}")

        print("-" * 86)
        print(f"З координатами: {with_coords} із {len(businesses)}")

        if with_coords == 0:
            print("\nЖоден заклад не має координат - пошук «поблизу» не працюватиме.")
            print("Запустіть: python scripts/backfill_coordinates.py")
        elif with_coords < len(businesses):
            print("\nЧастина закладів без координат - вони йтимуть у кінець списку.")


if __name__ == "__main__":
    asyncio.run(main())
