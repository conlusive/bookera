import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_async_engine(
    DATABASE_URL,
    echo=True, # (якщо в тебе це було)
    connect_args={"statement_cache_size": 0}  # 🔥 ДОДАЙ ОСЬ ЦЕЙ РЯДОК
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)