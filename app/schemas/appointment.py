from pydantic import BaseModel
from datetime import datetime
from app.models.base import StatusEnum

class AppointmentBase(BaseModel):
    start_time: datetime

class AppointmentCreate(AppointmentBase):
    business_id: int
    service_id: int
    client_id: int

class AppointmentResponse(AppointmentBase):
    id: int
    business_id: int
    service_id: int
    client_id: int
    end_time: datetime
    status: StatusEnum

    class Config:
        from_attributes = True