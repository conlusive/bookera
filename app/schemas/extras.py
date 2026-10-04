from datetime import date as dt_date, datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    master_rating: Optional[int] = None
    salon_rating: Optional[int] = None
    comment: Optional[str] = None
    business_reply: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class InventoryItemCreate(BaseModel):
    business_id: int
    name: str = Field(..., min_length=1, max_length=120)
    quantity: float = Field(0, ge=0, le=1_000_000)
    unit: str = Field("шт", min_length=1, max_length=20)
    low_stock_threshold: Optional[float] = Field(None, ge=0, le=1_000_000)
    cost_per_unit: Optional[float] = Field(None, ge=0, le=1_000_000)

    @field_validator("name", "unit")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Поле не може бути порожнім")
        return v


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    quantity: Optional[float] = Field(None, ge=0, le=1_000_000)
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    low_stock_threshold: Optional[float] = Field(None, ge=0, le=1_000_000)
    cost_per_unit: Optional[float] = Field(None, ge=0, le=1_000_000)

    @field_validator("name", "unit")
    @classmethod
    def _strip(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Поле не може бути порожнім")
        return v


class InventoryItemResponse(InventoryItemCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ExpenseCreate(BaseModel):
    business_id: int
    category: Optional[str] = Field(None, max_length=60)
    description: Optional[str] = Field(None, max_length=200)
    amount: float = Field(..., gt=0, le=10_000_000)
    expense_date: dt_date = Field(default_factory=dt_date.today)
    recurrence: Literal["none", "weekly", "monthly"] = "none"


class ExpenseUpdate(BaseModel):
    category: Optional[str] = Field(None, max_length=60)
    description: Optional[str] = Field(None, max_length=200)
    amount: Optional[float] = Field(None, gt=0, le=10_000_000)
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
