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
# Тести не ходять у публічний OSRM: інакше результат залежить від інтернету
# (з мережею - дорожня відстань, без - пряма). Недоступна адреса = завжди пряма.
os.environ["OSRM_URL"] = "http://127.0.0.1:9"
os.environ["OSRM_FALLBACK_URLS"] = ""
# Тести НІКОЛИ не шлють справжні листи: порожні SMTP-дані (load_dotenv їх не перезапише) вмикають
# режим «Email Mock». Інакше з налаштованим Gmail кожен прогін розсилав би листи на вигадані
# адреси test.com, а користувач отримував би сотні відскоків.
for _k in ("SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"):
    os.environ[_k] = ""
JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]
DB_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/bookera_test")
# Запобіжник: тести очищають таблиці (TRUNCATE ... CASCADE). Якщо в оточенні (наприклад, після `source .env`)
# лежить адреса справжньої бази, вони стерли б реальні дані. Дозволяємо лише базу з «test» у назві.
_DB_NAME = DB_URL.rsplit("/", 1)[-1].split("?")[0]
if "test" not in _DB_NAME.lower():
    pytest.exit(
        f"ВІДМОВА: DATABASE_URL вказує на базу «{_DB_NAME}», а не тестову. Тести очищають таблиці й знищили б реальні дані. "
        "Запускайте без `source .env` або вкажіть базу на кшталт bookera_test.",
        returncode=3,
    )


def make_token(user_id: str, role: str = "business_owner", email: str = None, full_name: str = None) -> str:
    return jwt.encode(
        {
            "sub": user_id,
            "aud": "authenticated",
            "email": email or f"{user_id}@test.com",
            "user_metadata": {"role": role, **({"full_name": full_name} if full_name else {})},
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
    async def _as_registered_guest(request):
        # Запис і резерв слота - лише для користувача, що увійшов. Більшість тестів лише «записує клієнта»,
        # тож за замовчуванням підставляємо звичайного клієнта; заголовок X-Test-Anon вимикає підстановку.
        if request.url.path in ("/appointments", "/appointments/lock", "/appointments/unlock") and request.method == "POST":
            if "x-test-anon" in request.headers:
                del request.headers["x-test-anon"]
            elif "authorization" not in request.headers:
                request.headers["Authorization"] = f"Bearer {make_token('test-guest', 'client')}"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test",
                           event_hooks={"request": [_as_registered_guest]}) as c:
        yield c


@pytest_asyncio.fixture
def auth_headers():
    def _make(user_id: str, role: str = "business_owner"):
        return {"Authorization": f"Bearer {make_token(user_id, role)}"}
    return _make

@pytest_asyncio.fixture
async def legacy_duplicates():
    """
    Для тестів, що перевіряють ОБʼЄДНАННЯ старих дублів: у базі діють унікальні індекси клієнтів, тож на час тесту
    їх знімаємо, а після - прибираємо дані й повертаємо індекси як було.
    """
    from sqlalchemy import text
    engine = create_async_engine(DB_URL)
    async with engine.begin() as conn:
        await conn.execute(text("DROP INDEX IF EXISTS uq_clients_business_phone"))
        await conn.execute(text("DROP INDEX IF EXISTS uq_clients_business_email"))
    yield
    from tests import conftest as _c  # noqa: F401
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE appointments, services, users, businesses, clients, staff_invites, business_hours, reviews, inventory_items, expenses, client_links, service_addons CASCADE"))
        await conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_business_phone ON clients (business_id, (RIGHT(regexp_replace(phone, '\\D', '', 'g'), 9))) "
            "WHERE phone IS NOT NULL AND length(regexp_replace(phone, '\\D', '', 'g')) >= 9"))
        await conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_business_email ON clients (business_id, (lower(btrim(email)))) "
            "WHERE email IS NOT NULL AND btrim(email) <> ''"))
    await engine.dispose()
