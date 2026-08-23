from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import businesses, services, appointments
from app.models.base import Base
from app.core.database import engine

app = FastAPI(
    title="BookEra API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/")
async def health_check():
    return {"status": "active", "service": "BookEra Engine"}