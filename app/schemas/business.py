from pydantic import BaseModel

class BusinessBase(BaseModel):
    name: str
    slug: str  # Це унікальна частина URL, наприклад: "cool-barbershop"
    address: str

class BusinessCreate(BusinessBase):
    owner_id: int  # Поки що будемо передавати ID власника вручну (нашого id: 1)

class BusinessResponse(BusinessBase):
    id: int
    owner_id: int

    class Config:
        from_attributes = True