from fastapi import FastAPI
from app.api import users, businesses, services, appointments
from fastapi.middleware.cors import CORSMiddleware
from app.models.base import Base
from app.core.database import engine



app = FastAPI(
    title="BookEra API",
    description="Backend engine for BookEra - The ultimate booking platform",
    version="1.0.0",
    redirect_slashes=False
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Підключення роутерів
app.include_router(users.router, prefix="/users")
app.include_router(businesses.router, prefix="/businesses")
app.include_router(services.router, prefix="/services")
app.include_router(appointments.router, prefix="/appointments")

@app.get("/")
async def health_check():
    return {"status": "active", "message": "BookEra API is running"}