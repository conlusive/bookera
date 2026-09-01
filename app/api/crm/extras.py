import uuid
from datetime import timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, assert_business_admin, get_current_user
from app.core.rate_limit import rate_limit
from app.models import Review, InventoryItem, Expense
from app.schemas.extras import (
    ReviewCreate, ReviewReply, ReviewResponse,
    InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse,
    ExpenseCreate, ExpenseUpdate, ExpenseResponse,
)

router = APIRouter(tags=["CRM - Extras"])


# === Відгуки: створення публічне (клієнт лишає відгук), відповідь бізнесу - захищена ===

@router.post("/public/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review_in: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    _rl=Depends(rate_limit("review", max_requests=5, window_seconds=3600)),
):
    review = Review(**review_in.model_dump())
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review


@router.get("/public/reviews", response_model=List[ReviewResponse])
async def list_reviews(
    business_id: int = Query(...),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Review).where(Review.business_id == business_id)
        .order_by(Review.created_at.desc()).limit(limit).offset(offset)
    )
    return result.scalars().all()


@router.patch("/crm/reviews/{review_id}/reply", response_model=ReviewResponse)
async def reply_to_review(
    review_id: int, payload: ReviewReply,
    db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalars().first()
    if not review:
        raise HTTPException(status_code=404, detail="Відгук не знайдено")
    await assert_business_access(db, current_user, review.business_id)
    review.business_reply = payload.business_reply
    await db.commit()
    await db.refresh(review)
    return review


# === Склад ===

@router.get("/crm/inventory", response_model=List[InventoryItemResponse])
async def list_inventory(business_id: int = Query(...), db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    await assert_business_access(db, current_user, business_id)
    result = await db.execute(select(InventoryItem).where(InventoryItem.business_id == business_id))
    return result.scalars().all()


@router.post("/crm/inventory", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(item_in: InventoryItemCreate, db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    await assert_business_access(db, current_user, item_in.business_id)
    item = InventoryItem(**item_in.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/crm/inventory/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(item_id: int, payload: InventoryItemUpdate, db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Позицію не знайдено")
    await assert_business_access(db, current_user, item.business_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/crm/inventory/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_item(item_id: int, db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Позицію не знайдено")
    await assert_business_access(db, current_user, item.business_id)
    await db.delete(item)
    await db.commit()


# === Витрати ===

def _generate_future_dates(start_date, recurrence: str, count: int) -> List:
    """monthly - той самий день кожного наступного місяця; weekly - +7 днів."""
    from dateutil.relativedelta import relativedelta
    dates = []
    for i in range(1, count + 1):
        if recurrence == "weekly":
            dates.append(start_date + timedelta(weeks=i))
        else:
            dates.append(start_date + relativedelta(months=i))
    return dates


@router.get("/crm/expenses", response_model=List[ExpenseResponse])
async def list_expenses(business_id: int = Query(...), db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    await assert_business_admin(db, current_user, business_id)
    result = await db.execute(select(Expense).where(Expense.business_id == business_id).order_by(Expense.expense_date.desc()))
    return result.scalars().all()


@router.post("/crm/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(expense_in: ExpenseCreate, db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    """
    Якщо recurrence != 'none' - одразу створює й майбутні входження
    (12 для щомісячних, 52 для щотижневих - той самий горизонт, що був
    у старому фронтенд-коді), усі під одним recurrence_group_id, щоб
    їх можна було надійно знайти й змінити разом пізніше.
    """
    await assert_business_admin(db, current_user, expense_in.business_id)

    group_id = str(uuid.uuid4()) if expense_in.recurrence != "none" else None
    expense = Expense(**expense_in.model_dump(), recurrence_group_id=group_id)
    db.add(expense)
    await db.flush()

    if expense_in.recurrence != "none":
        count = 52 if expense_in.recurrence == "weekly" else 12
        future_dates = _generate_future_dates(expense_in.expense_date, expense_in.recurrence, count)
        for d in future_dates:
            db.add(Expense(
                business_id=expense_in.business_id,
                category=expense_in.category,
                description=expense_in.description,
                amount=expense_in.amount,
                expense_date=d,
                recurrence=expense_in.recurrence,
                recurrence_group_id=group_id,
            ))

    await db.commit()
    await db.refresh(expense)
    return expense


@router.patch("/crm/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(expense_id: int, payload: ExpenseUpdate, db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalars().first()
    if not expense:
        raise HTTPException(status_code=404, detail="Витрату не знайдено")
    await assert_business_admin(db, current_user, expense.business_id)

    old_date = expense.expense_date
    apply_to_future = payload.apply_to_future
    data = payload.model_dump(exclude_unset=True, exclude={"apply_to_future"})
    for field, value in data.items():
        setattr(expense, field, value)

    if apply_to_future and expense.recurrence_group_id and ("expense_date" in data or "amount" in data):
        day_delta = (expense.expense_date - old_date).days
        future_res = await db.execute(
            select(Expense).where(
                Expense.recurrence_group_id == expense.recurrence_group_id,
                Expense.id != expense.id,
                Expense.expense_date > old_date,
            )
        )
        for future_exp in future_res.scalars().all():
            if "expense_date" in data and day_delta:
                future_exp.expense_date = future_exp.expense_date + timedelta(days=day_delta)
            if "amount" in data:
                future_exp.amount = expense.amount

    await db.commit()
    await db.refresh(expense)
    return expense


@router.delete("/crm/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: int,
    delete_future: bool = Query(False, description="Видалити також усі майбутні входження цієї серії"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalars().first()
    if not expense:
        raise HTTPException(status_code=404, detail="Витрату не знайдено")
    await assert_business_admin(db, current_user, expense.business_id)

    if delete_future and expense.recurrence_group_id:
        await db.execute(
            Expense.__table__.delete().where(
                Expense.recurrence_group_id == expense.recurrence_group_id,
                Expense.expense_date >= expense.expense_date,
            )
        )
    else:
        await db.delete(expense)
    await db.commit()
