import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Для роботи asyncpg через Supabase Transaction Pooler (порт 6543): pgbouncer у
# transaction-режимі не підтримує server-side prepared statements, тому вони
# вимкнені тут. Пул з'єднань SQLAlchemy сидить ПОВЕРХ пулу pgbouncer - це
# нормально для довготривалого процесу (не serverless), головне тримати його
# помірним, щоб не вичерпати ліміт з'єднань pgbouncer при кількох інстансах бекенду.
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "20")),
    # Перевіряє з'єднання коротким SELECT 1 перед видачею з пулу - без цього
    # "мертве" з'єднання (Supabase/pgbouncer розірвали по тайм-ауту) призводить
    # до "server closed the connection unexpectedly" посеред обробки запиту.
    pool_pre_ping=True,
    # Проактивно оновлює з'єднання кожні 30 хв, не чекаючи, поки сервер
    # розірве його самостійно.
    pool_recycle=1800,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    },
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            # Явний rollback під конкурентним навантаженням надійніший, ніж
            # покладатись лише на неявний rollback всередині close().
            await session.rollback()
            raise
        finally:
            await session.close()
