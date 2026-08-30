from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class ServiceBase(BaseModel):
    name: str = Field(..., min_length=2)
    duration_minutes: int = Field(..., ge=5, le=480)
    price: float = Field(..., ge=0.0)
    is_group: bool = False
    max_participants: int = 1


class ServiceCreate(ServiceBase):
    business_id: int
    # Список id інших послуг цього ж бізнесу як "додаткові" (upsell).
    # Зберігається в окремій таблиці service_addons, а не JSON-полем.
    addon_service_ids: Optional[List[int]] = None


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    duration_minutes: Optional[int] = None
    price: Optional[float] = None
    is_group: Optional[bool] = None
    max_participants: Optional[int] = None
    is_active: Optional[bool] = None
    order_index: Optional[int] = None
    addon_service_ids: Optional[List[int]] = None


class ServiceResponse(ServiceBase):
    id: int
    business_id: int
    is_active: bool = True
    order_index: int = 0
    addon_service_ids: List[int] = []

    model_config = ConfigDict(from_attributes=True)


class ServiceOut(ServiceResponse):
    pass
