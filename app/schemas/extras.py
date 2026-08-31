from datetime import date as dt_date, datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class ReviewCreate(BaseModel):
    business_id: int
    appointment_id: Optional[int] = None
    author_name: Optional[str] = None
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class ReviewReply(BaseModel):
    business_reply: str


class ReviewResponse(BaseModel):
    id: int
    business_id: int
    appointment_id: Optional[int] = None
    author_name: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    business_reply: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class InventoryItemCreate(BaseModel):
    business_id: int
    name: str
    quantity: float = 0
    unit: str = "шт"
    low_stock_threshold: Optional[float] = None
    cost_per_unit: Optional[float] = None


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    low_stock_threshold: Optional[float] = None
    cost_per_unit: Optional[float] = None


class InventoryItemResponse(InventoryItemCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ExpenseCreate(BaseModel):
    business_id: int
    category: Optional[str] = None
    description: Optional[str] = None
    amount: float
    expense_date: dt_date = Field(default_factory=dt_date.today)
    recurrence: Literal["none", "weekly", "monthly"] = "none"


class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    expense_date: Optional[dt_date] = None
    recurrence: Optional[Literal["none", "weekly", "monthly"]] = None
    # Якщо true і ця витрата - частина повторюваної серії, застосовує ту саму
    # зміну дати/суми до всіх МАЙБУТНІХ входжень цієї ж серії (той самий
    # зсув у днях, та сама нова сума) - замість крихкого зіставлення за
    # текстом category+description, як робив старий фронтенд-код.
    apply_to_future: bool = False


class ExpenseResponse(BaseModel):
    id: int
    business_id: int
    category: Optional[str] = None
    description: Optional[str] = None
    amount: float
    expense_date: dt_date
    recurrence: str = "none"
    recurrence_group_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
