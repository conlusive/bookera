import asyncio
from app.core.database import engine
from app.models.base import Base
# Обов'язковий імпорт моделей для реєстрації у метаданих
from app.models.user import User, Business, Service, Appointment, Transaction, Coupon


async def init_models():
    print("Підключення до бази даних...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Всі таблиці успішно створено та синхронізовано!")


if __name__ == "__main__":
    asyncio.run(init_models())