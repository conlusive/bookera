
from pydantic import BaseModel
from datetime import datetime

class AppointmentCreate(BaseModel):
    business_id: int
    service_id: int
    client_id: int
    master_id: int  # <-- Додали сюди
    start_time: datetime

class AppointmentResponse(BaseModel):
    id: int
    business_id: int
    service_id: int
    client_id: int
    master_id: int  # <-- І сюди
    start_time: datetime
    status: str
    class Config:
        from_attributes = True