from fastapi import FastAPI
from app.api import users, businesses, services, appointments
from fastapi.middleware.cors import CORSMiddleware

# Для діагностики
print(f"DEBUG: businesses.py завантажено з: {businesses.__file__}")

app = FastAPI(
    title="BookEra API",
    description="Backend engine for BookEra - The ultimate booking platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Підключаємо роутери з чіткими префіксами
app.include_router(users.router, prefix="/users")
app.include_router(businesses.router, prefix="/businesses")
app.include_router(services.router, prefix="/services")
app.include_router(appointments.router, prefix="/appointments")

@app.get("/")
async def health_check():
    return {
        "status": "active",
        "project": "BookEra",
        "message": "API is up and running!"
    }