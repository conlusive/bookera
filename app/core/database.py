import os
from dotenv import load_dotenv
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Для роботи asyncpg через Supabase Transaction Pooler (порт 6543): pgbouncer у
# transaction-режимі не підтримує server-side prepared statements, тому вони
# вимкнені тут. Пул з'єднань SQLAlchemy сидить ПОВЕРХ пулу pgbouncer - це
# нормально для довготривалого процесу (не serverless), головне тримати його
# помірним, щоб не вичерпати ліміт з'єднань pgbouncer при кількох інстансах бекенду.
# Пул зʼєднань вимикається під тестами.
#
# У продакшні пул потрібен: один процес живе довго, і відкривати
# зʼєднання на кожен запит дорого.
#
# Але в тестах кожен тест отримує власний event loop, а asyncpg
# привʼязує зʼєднання до того циклу, де воно створене. Зʼєднання
# з пулу, створене в попередньому тесті, у наступному давало
# RuntimeError про задачу з чужого циклу - і падало 56 тестів
# із 86, хоча код був правильний.
_pool_kwargs = (
    {"poolclass": NullPool}
    if os.getenv("PYTEST_CURRENT_TEST") or os.getenv("DISABLE_DB_POOL") == "1"
    else {
        "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "20")),
    }
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    **_pool_kwargs,
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
