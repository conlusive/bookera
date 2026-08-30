from datetime import date as dt_date, datetime
from typing import Optional
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
    is_recurring: bool = False


class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    expense_date: Optional[dt_date] = None
    is_recurring: Optional[bool] = None


class ExpenseResponse(ExpenseCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)
