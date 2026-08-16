from typing import Optional, Union, List
from pydantic import BaseModel, Field, ConfigDict


class ServiceBase(BaseModel):
    name: str = Field(..., min_length=2)
    duration_minutes: int = Field(..., ge=5, le=480)
    price: float = Field(..., ge=0.0)
    is_group: bool = False
    max_participants: int = 1
    addon_service_ids: Optional[Union[dict, list]] = None


class ServiceCreate(ServiceBase):
    business_id: int


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    duration_minutes: Optional[int] = None
    price: Optional[float] = None
    is_group: Optional[bool] = None
    max_participants: Optional[int] = None
    addon_service_ids: Optional[Union[dict, list]] = None


class ServiceResponse(ServiceBase):
    id: int
    business_id: int
    model_config = ConfigDict(from_attributes=True)


class ServiceOut(ServiceResponse):
    pass