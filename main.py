from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import users, businesses, services, appointments
from app.models.base import Base
from app.core.database import engine

# 🔥 ОЦЕЙ РЯДОК ОБОВ'ЯЗКОВИЙ, щоб SQLAlchemy дізналась про таблиці перед їх створенням
from app.models.user import User, Business, Service, Appointment

app = FastAPI(
    title="BookEra API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app.include_router(businesses.router, prefix="/businesses", tags=["Businesses"])
app.include_router(services.router, prefix="/services", tags=["Services"])
app.include_router(appointments.router, prefix="/appointments", tags=["Appointments"])
app.include_router(users.router, prefix="/auth", tags=["Authentication"])

@app.get("/")
async def health_check():
    return {"status": "active"}