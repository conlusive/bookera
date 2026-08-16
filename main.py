from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import users, businesses, services, appointments
from app.models.base import Base
from app.core.database import engine

app = FastAPI(
    title="BookEra API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


app.include_router(businesses.router)
app.include_router(services.router)
app.include_router(appointments.router)
app.include_router(users.router, prefix="/auth")


@app.get("/")
async def health_check():
    return {"status": "active"}