"""
Запуск: DATABASE_URL=postgresql+asyncpg://... SUPABASE_JWT_SECRET=test-secret pytest tests/ -v

Потребує реального Postgres з розширенням btree_gist (див. migrations/).
Кожен тест отримує чисту базу - жодних побічних ефектів між тестами.
"""
import os
import jwt
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine

os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-for-pytest-only")
JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]
DB_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/bookera_test")


def make_token(user_id: str, role: str = "business_owner", email: str = None) -> str:
    return jwt.encode(
        {
            "sub": user_id,
            "aud": "authenticated",
            "email": email or f"{user_id}@test.com",
            "user_metadata": {"role": role},
            "exp": 9999999999,
        },
        JWT_SECRET,
        algorithm="HS256",
    )


@pytest_asyncio.fixture(scope="function")
async def clean_db():
    """Очищає всі таблиці перед кожним тестом - тести не залежать один від одного."""
    engine = create_async_engine(DB_URL)
    async with engine.begin() as conn:
        from sqlalchemy import text
        await conn.execute(text(
            "TRUNCATE appointments, services, users, businesses, clients, "
            "staff_invites, business_hours, reviews, inventory_items, expenses, "
            "client_links, service_addons CASCADE"
        ))
    await engine.dispose()
    yield


@pytest_asyncio.fixture(scope="function")
async def client(clean_db):
    os.environ["DATABASE_URL"] = DB_URL
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
def auth_headers():
    def _make(user_id: str, role: str = "business_owner"):
        return {"Authorization": f"Bearer {make_token(user_id, role)}"}
    return _make
