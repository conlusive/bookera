from pydantic import BaseModel
from datetime import datetime

class AppointmentCreate(BaseModel):
    business_id: int
    service_id: int
    client_id: int
    master_id: int
    start_time: datetime
    source: str = "Онлайн (Сторінка салону)"

class AppointmentResponse(BaseModel):
    id: int
    business_id: int
    service_id: int
    client_id: int
    master_id: int
    start_time: datetime
    status: str
    source: str

    class Config:
        from_attributes = True

# ОНОВЛЕНО: Додано service_id (для тривалості) та client_id (для ідентифікації лока)
class LockSlotRequest(BaseModel):
    business_id: int
    master_id: int
    service_id: int
    client_id: int
    start_time: datetime