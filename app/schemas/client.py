from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class ClientBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    allergies: Optional[str] = None
    tags: Optional[List[str]] = None


class ClientCreate(ClientBase):
    business_id: int


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    allergies: Optional[str] = None
    tags: Optional[List[str]] = None
    is_blacklisted: Optional[bool] = None
    medical_pdf_url: Optional[str] = None


class ClientResponse(ClientBase):
    id: int
    business_id: int
    is_blacklisted: bool
    balance: float
    visits_count: int
    total_spent: float
    last_visit_at: Optional[datetime] = None
    medical_pdf_url: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


ClientOut = ClientResponse
