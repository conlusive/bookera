from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator


class ClientBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    allergies: Optional[str] = None
    tags: Optional[List[str]] = None
    birthday: Optional[date] = None
    instagram: Optional[str] = None


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
    birthday: Optional[date] = None
    instagram: Optional[str] = None
    formulas: Optional[str] = None
    consent_photo: Optional[bool] = None
    consent_procedure: Optional[bool] = None
    balance: Optional[float] = None


class ClientResponse(ClientBase):
    id: int
    business_id: int
    is_blacklisted: bool
    balance: float
    # Рахуються із записів (services/client_stats.py), а не зі збережених
    # лічильників, які ніхто не оновлював.
    visits_count: int = 0
    total_spent: float = 0
    last_visit_at: Optional[datetime] = None
    next_visit_at: Optional[datetime] = None
    no_show_count: int = 0
    medical_pdf_url: Optional[str] = None
    formulas: Optional[str] = None
    consent_photo: bool = False
    consent_procedure: bool = False
    linked_client_ids: List[int] = []
    created_at: Optional[datetime] = None

    @field_validator("balance", "visits_count", "total_spent", "no_show_count", mode="before")
    @classmethod
    def _none_is_zero(cls, v):
        # Порожнє в базі (клієнти, створені не через кабінет) - це 0, а не
        # причина впасти всьому списку клієнтів.
        return 0 if v is None else v

    model_config = ConfigDict(from_attributes=True)


ClientOut = ClientResponse
