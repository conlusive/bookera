import asyncio
from app.core.database import engine, Base
# Обов'язково імпортуємо всі моделі, щоб SQLAlchemy знала про них до створення таблиць
from app.models.base import User, Business, Service, Appointment

async def init_models():
    print("Підключення до бази даних...")
    async with engine.begin() as conn:
        # Видаляємо старі таблиці, якщо вони були (зручно для скидання бази при розробці)
        await conn.run_sync(Base.metadata.drop_all)
        # Створюємо всі таблиці заново
        await conn.run_sync(Base.metadata.create_all)
    print("Всі таблиці успішно створено!")

if __name__ == "__main__":
    asyncio.run(init_models())