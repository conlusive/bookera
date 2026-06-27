
from pydantic import BaseModel

class ServiceBase(BaseModel):
    name: str
    duration_minutes: int
    price: float

class ServiceCreate(ServiceBase):
    business_id: int

class ServiceResponse(ServiceBase):
    id: int
    business_id: int

    class Config:
        from_attributes = True