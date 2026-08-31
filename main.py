import os
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import businesses, services, appointments
from app.api.crm import (
    clients as crm_clients,
    staff as crm_staff,
    business as crm_business,
    extras as crm_extras,
    appointments as crm_appointments,
    stats as crm_stats,
    monetization as crm_monetization,
)
from app.core.database import engine, AsyncSessionLocal
from app.core.logging_config import logger

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Схема тепер керується виключно через Alembic (`alembic upgrade head`),
    # а не create_all. create_all не вміє ALTER на існуючих таблицях і
    # тихо ігнорує розбіжності - Alembic натомість версіонує кожну зміну
    # і однаково працює і на новій базі, і на вже задеплоєній.
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Успішне підключення до бази даних")
    except Exception as e:
        logger.error(f"Проблема при старті/підключенні до БД: {e}")
    yield


app = FastAPI(
    title="BookEra API",
    version="1.0.0",
    lifespan=lifespan,
)

# Раніше було ["http://localhost:3000", "*"] з allow_credentials=True -
# суперечлива і небезпечна комбінація ("*" + credentials по суті дозволяє
# будь-якому сайту робити авторизовані запити). Список доменів тепер явний,
# задається через .env (щоб не хардкодити прод-домен у коді).
_allowed_origins = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def add_request_id_and_timing(request: Request, call_next):
    """
    Кожен запит отримує унікальний ID і час обробки в логах - без цього
    під навантаженням неможливо зіставити помилку клієнта з конкретним
    рядком у серверних логах серед тисяч інших запитів.
    """
    request_id = str(uuid.uuid4())[:8]
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    if duration_ms > 1000:  # повільні запити - завжди варті окремого логу
        logger.warning(f"[{request_id}] ПОВІЛЬНИЙ запит {request.method} {request.url.path} - {duration_ms:.0f}ms")
    return response


# === Глобальна обробка помилок ===
# Раніше необроблений виняток повертав клієнту сирий Python traceback з
# деталями коду й структури бази - реальна знахідка для зловмисника, окрім
# того що це просто виглядає непрофесійно. Тепер: клієнт завжди отримує
# охайний JSON, повна деталь - тільки в серверних логах.

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": "Некоректні дані запиту", "errors": exc.errors()},
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.warning(f"IntegrityError на {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "Конфлікт даних - можливо, запис вже існує або порушено зв'язок"},
    )


@app.exception_handler(SQLAlchemyError)
async def db_error_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Помилка бази даних на {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Тимчасова проблема з базою даних, спробуйте ще раз"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Необроблений виняток на {request.url.path}: {exc!r}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Внутрішня помилка сервера"},
    )


app.include_router(businesses.router)
app.include_router(services.router)
app.include_router(appointments.router)
app.include_router(crm_clients.router)
app.include_router(crm_staff.router)
app.include_router(crm_business.router)
app.include_router(crm_extras.router)
app.include_router(crm_appointments.router)
app.include_router(crm_stats.router)
app.include_router(crm_monetization.router)


@app.get("/")
async def root():
    return {"status": "active", "service": "BookEra Engine"}


@app.get("/health")
async def health_check():
    """
    Реальна перевірка готовності (для load balancer / uptime monitoring),
    а не просто 'процес живий'. Перевіряє, що БД дійсно відповідає.
    """
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check: БД недоступна - {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "database": "disconnected"},
        )
