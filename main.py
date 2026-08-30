import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import businesses, services, appointments
from app.api.crm import clients as crm_clients, staff as crm_staff, business as crm_business, extras as crm_extras
from app.models.base import Base
from app.core.database import engine

app = FastAPI(
    title="BookEra API",
    version="1.0.0"
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


@app.on_event("startup")
async def startup_event():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print(" Успішне підключення до бази даних Supabase")
    except Exception as e:
        print(f"⚠️ Попередження підключення до БД: {e}")


app.include_router(businesses.router)
app.include_router(services.router)
app.include_router(appointments.router)
app.include_router(crm_clients.router)
app.include_router(crm_staff.router)
app.include_router(crm_business.router)
app.include_router(crm_extras.router)


@app.get("/")
async def health_check():
    return {"status": "active", "service": "BookEra Engine"}