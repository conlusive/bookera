import uuid
from datetime import timedelta, date as dt_date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, assert_business_admin, get_current_user, assert_section
from app.core.rate_limit import rate_limit
from app.core.time_utils import to_local, utc_now
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
    # ЗАКРИТО. Маршрут приймав відгук від будь-кого - без входу й без
    # візиту: будь-яке імʼя, будь-яка оцінка, будь-який заклад. Перевірка
    # входу була лише в браузері й обходилась одним прямим запитом -
    # конкурент міг засипати заклад одиницями. Рейтинг він теж не оновлював.
    #
    # Тепер відгук - лише на власний завершений візит:
    # POST /appointments/{id}/review (за токеном керування записом).
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Відгук можна залишити після візиту - у профілі, розділ «Мої візити»",
    )


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
    await assert_business_admin(db, current_user, review.business_id)
    review.business_reply = payload.business_reply
    await db.commit()
    await db.refresh(review)
    return review


# === Склад ===

ITEM_LABELS = {"name": "Назва", "quantity": "Залишок", "unit": "Одиниця", "low_stock_threshold": "Мін. запас", "cost_per_unit": "Ціна за од., ₴"}
EXPENSE_LABELS = {"category": "Категорія", "description": "Опис", "amount": "Сума, ₴", "expense_date": "Дата", "recurrence": "Повтор"}


@router.get("/crm/inventory", response_model=List[InventoryItemResponse])
async def list_inventory(business_id: int = Query(...), db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    await assert_business_access(db, current_user, business_id)
    result = await db.execute(select(InventoryItem).where(InventoryItem.business_id == business_id))
    return result.scalars().all()


@router.post("/crm/inventory", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(item_in: InventoryItemCreate, db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    await assert_section(db, current_user, item_in.business_id, "inventory")
    item = InventoryItem(**item_in.model_dump())
    db.add(item)
    await db.flush()
    # Початковий залишок - в історію руху, щоб з неї сходився поточний
    if item.quantity:
        from app.models import InventoryMovement
        db.add(InventoryMovement(business_id=item.business_id, inventory_item_id=item.id,
                                 quantity_delta=item.quantity, cost_at_moment=item.cost_per_unit, reason="initial"))
    # Журнал дій
    from app.services.audit import record as _audit
    await _audit(db, item.business_id, str(current_user.id), "inventory", "item_created", f"Додано на склад: {item.name}")
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/crm/inventory/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(item_id: int, payload: InventoryItemUpdate, db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Позицію не знайдено")
    await assert_section(db, current_user, item.business_id, "inventory")
    data = payload.model_dump(exclude_unset=True)
    # Ручне виправлення кількості (інвентаризація) - слід в історії руху.
    # Раніше число просто перезаписувалось, і не було видно, куди поділось.
    if "quantity" in data and data["quantity"] is not None:
        from decimal import Decimal as _D
        from app.models import InventoryMovement
        delta = _D(str(data["quantity"])) - _D(str(item.quantity or 0))
        if delta != 0:
            db.add(InventoryMovement(business_id=item.business_id, inventory_item_id=item.id,
                                     quantity_delta=delta, cost_at_moment=item.cost_per_unit, reason="adjustment"))
    from app.services.audit import changes_text, diff_changes, record as _audit
    before = {f: getattr(item, f, None) for f in data}
    for field, value in data.items():
        setattr(item, field, value)
    changes = diff_changes(before, data, ITEM_LABELS)
    if changes:
        await _audit(db, item.business_id, str(current_user.id), "inventory", "item_updated",
                     f"Змінено товар {item.name}: {changes_text(changes)}"[:500], meta={"item_id": item.id, "changes": changes})
    await db.commit()
    await db.refresh(item)
    return item


class RestockIn(BaseModel):
    quantity: float = Field(gt=0, le=1_000_000)
    cost_per_unit: Optional[float] = Field(default=None, ge=0, le=1_000_000)
    add_expense: bool = True
    note: Optional[str] = Field(default=None, max_length=200)


@router.post("/crm/inventory/{item_id}/restock", response_model=InventoryItemResponse)
async def restock_inventory_item(item_id: int, payload: RestockIn, db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    """
    Прихід товару: +кількість, нова ціна за одиницю, запис в історії руху
    і (за замовчуванням) витрата «Матеріали» на суму закупівлі - тож гроші
    за товар видно у витратах, а не лише кількість на складі.
    """
    from decimal import Decimal as _D
    from app.models import InventoryMovement
    from app.core.time_utils import local_now
    item = (await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))).scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Позицію не знайдено")
    await assert_section(db, current_user, item.business_id, "inventory")
    qty = _D(str(payload.quantity))
    if payload.cost_per_unit is not None:
        item.cost_per_unit = _D(str(payload.cost_per_unit))
    item.quantity = _D(str(item.quantity or 0)) + qty
    db.add(InventoryMovement(business_id=item.business_id, inventory_item_id=item.id,
                             quantity_delta=qty, cost_at_moment=item.cost_per_unit, reason="restock"))
    total = (qty * _D(str(item.cost_per_unit or 0))).quantize(_D("0.01"))
    if payload.add_expense and total > 0:
        db.add(Expense(business_id=item.business_id, category="Матеріали",
                       description=(payload.note or f"Закупівля: {item.name} × {payload.quantity:g} {item.unit}")[:200],
                       amount=total, expense_date=local_now().date(), recurrence="none"))
    from app.services.audit import record as _audit
    await _audit(db, item.business_id, str(current_user.id), "inventory", "restock",
                 f"Прихід: {item.name} +{payload.quantity:g} {item.unit}" + (f" на {total} ₴" if total > 0 else ""))
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/crm/inventory/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_item(item_id: int, db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Позицію не знайдено")
    await assert_section(db, current_user, item.business_id, "inventory")
    from app.services.audit import record as _audit
    await _audit(db, item.business_id, str(current_user.id), "inventory", "item_deleted", f"Видалено зі складу: {item.name}")
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
    await assert_section(db, current_user, business_id, "inventory")
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
    await assert_section(db, current_user, expense_in.business_id, "inventory")

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

    # Журнал дій

    from app.services.audit import record as _audit

    await _audit(db, expense.business_id, str(current_user.id), "inventory", "expense_created", f"Витрата: {expense.amount} ₴" + (f" - {expense.description}" if getattr(expense, "description", None) else ""))

    await db.commit()
    await db.refresh(expense)
    return expense


@router.patch("/crm/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(expense_id: int, payload: ExpenseUpdate, db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalars().first()
    if not expense:
        raise HTTPException(status_code=404, detail="Витрату не знайдено")
    await assert_section(db, current_user, expense.business_id, "inventory")

    old_date = expense.expense_date
    apply_to_future = payload.apply_to_future
    data = payload.model_dump(exclude_unset=True, exclude={"apply_to_future"})
    from app.services.audit import changes_text, diff_changes, record as _audit
    before = {f: getattr(expense, f, None) for f in data}
    for field, value in data.items():
        setattr(expense, field, value)
    changes = diff_changes(before, data, EXPENSE_LABELS)
    if changes:
        scope = " (і всі наступні)" if apply_to_future and expense.recurrence_group_id else ""
        await _audit(db, expense.business_id, str(current_user.id), "inventory", "expense_updated",
                     f"Змінено витрату{scope}: {changes_text(changes)}"[:500], meta={"expense_id": expense.id, "changes": changes})

    series_fields = {"expense_date", "amount", "category", "description"}
    if apply_to_future and expense.recurrence_group_id and series_fields & data.keys():
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
            if "category" in data:
                future_exp.category = expense.category
            if "description" in data:
                future_exp.description = expense.description

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
    await assert_section(db, current_user, expense.business_id, "inventory")

    from app.services.audit import record as _audit
    await _audit(db, expense.business_id, str(current_user.id), "inventory", "expense_deleted",
                 f"Видалено витрату: {expense.amount} ₴" + (f" - {expense.description}" if expense.description else "")
                 + (" (і всі наступні)" if delete_future and expense.recurrence_group_id else ""))
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


# === Матеріали, потрібні для послуги ===

class ServiceMaterialIn(BaseModel):
    inventory_item_id: int
    quantity_per_use: float = Field(..., gt=0)


class ServiceMaterialOut(BaseModel):
    id: int
    service_id: int
    inventory_item_id: int
    inventory_item_name: Optional[str] = None
    unit: Optional[str] = None
    quantity_per_use: float
    cost_per_use: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


@router.get("/crm/services/{service_id}/materials", response_model=List[ServiceMaterialOut])
async def list_service_materials(
    service_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    from app.models import Service, ServiceMaterial, InventoryItem

    srv_res = await db.execute(select(Service).where(Service.id == service_id))
    service = srv_res.scalars().first()
    if not service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")
    await assert_business_access(db, current_user, service.business_id)

    result = await db.execute(
        select(ServiceMaterial, InventoryItem)
        .join(InventoryItem, InventoryItem.id == ServiceMaterial.inventory_item_id)
        .where(ServiceMaterial.service_id == service_id)
    )
    out = []
    for material, item in result.all():
        qty = float(material.quantity_per_use or 0)
        unit_cost = float(item.cost_per_unit or 0)
        out.append(ServiceMaterialOut(
            id=material.id,
            service_id=material.service_id,
            inventory_item_id=item.id,
            inventory_item_name=item.name,
            unit=item.unit,
            quantity_per_use=qty,
            cost_per_use=round(qty * unit_cost, 2),
        ))
    return out


@router.put("/crm/services/{service_id}/materials", response_model=List[ServiceMaterialOut])
async def set_service_materials(
    service_id: int,
    materials: List[ServiceMaterialIn],
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Перезаписує весь перелік матеріалів послуги - простіше й надійніше
    за додавання/видалення по одному, бо UI редагує список цілком."""
    from app.models import Service, ServiceMaterial, InventoryItem

    srv_res = await db.execute(select(Service).where(Service.id == service_id))
    service = srv_res.scalars().first()
    if not service:
        raise HTTPException(status_code=404, detail="Послугу не знайдено")
    await assert_section(db, current_user, service.business_id, "services")

    # Перевіряємо, що всі позиції належать цьому ж закладу - інакше можна
    # було б підчепити матеріал чужого бізнесу за прямим id.
    for m in materials:
        item_res = await db.execute(
            select(InventoryItem).where(
                InventoryItem.id == m.inventory_item_id,
                InventoryItem.business_id == service.business_id,
            )
        )
        if not item_res.scalars().first():
            raise HTTPException(status_code=404, detail=f"Позицію складу {m.inventory_item_id} не знайдено")

    await db.execute(ServiceMaterial.__table__.delete().where(ServiceMaterial.service_id == service_id))
    for m in materials:
        db.add(ServiceMaterial(
            service_id=service_id,
            inventory_item_id=m.inventory_item_id,
            quantity_per_use=m.quantity_per_use,
        ))
    from app.services.audit import record as _audit
    await _audit(db, service.business_id, str(current_user.id), "services", "materials_set",
                 f"Матеріали послуги {service.name}: {len(materials)} {'позиція' if len(materials) == 1 else 'позицій'}")
    await db.commit()

    return await list_service_materials(service_id, db, current_user)


@router.get("/crm/inventory/{item_id}/movements")
async def list_inventory_movements(
    item_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Історія руху позиції складу - видно, куди дівся залишок."""
    from app.models import InventoryMovement

    item_res = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = item_res.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Позицію не знайдено")
    await assert_business_access(db, current_user, item.business_id)

    result = await db.execute(
        select(InventoryMovement)
        .where(InventoryMovement.inventory_item_id == item_id)
        .order_by(InventoryMovement.created_at.desc())
        .limit(limit)
    )
    moves = result.scalars().all()
    # Для списань за послугою - яка послуга й чий візит: видно, куди пішов товар
    from app.models import Appointment, Service
    appt_ids = {m.appointment_id for m in moves if m.appointment_id}
    appts = {a.id: a for a in (await db.execute(select(Appointment).where(Appointment.id.in_(appt_ids)))).scalars().all()} if appt_ids else {}
    srv_ids = {a.service_id for a in appts.values() if a.service_id}
    srv = {s.id: s.name for s in (await db.execute(select(Service).where(Service.id.in_(srv_ids)))).scalars().all()} if srv_ids else {}
    labels = {"service_usage": "Списано за послугою", "revert": "Повернуто (візит скасовано)",
              "restock": "Прихід", "adjustment": "Інвентаризація", "initial": "Початковий залишок"}
    out = []
    for m in moves:
        a = appts.get(m.appointment_id)
        out.append({
            "id": m.id,
            "quantity_delta": float(m.quantity_delta),
            "cost_at_moment": float(m.cost_at_moment) if m.cost_at_moment else None,
            "reason": m.reason,
            "label": labels.get(m.reason, m.reason),
            "appointment_id": m.appointment_id,
            "service": srv.get(a.service_id) if a else None,
            "client": a.client_name if a else None,
            "visit_at": a.start_time.isoformat() if a and a.start_time else None,
            # Час закладу, а не UTC: інакше нічний рух показується вчорашнім днем
            "created_at": to_local(m.created_at).isoformat() if m.created_at else None,
        })
    return out


# === Справи на день ===

class TaskIn(BaseModel):
    business_id: int
    task_date: dt_date
    text: str = Field(..., min_length=1, max_length=500)


class TaskUpdate(BaseModel):
    text: Optional[str] = Field(None, min_length=1, max_length=500)
    completed: Optional[bool] = None


class TaskOut(BaseModel):
    id: int
    business_id: int
    task_date: dt_date
    text: str
    completed: bool
    created_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


@router.get("/crm/tasks", response_model=List[TaskOut])
async def list_tasks(
    business_id: int = Query(...),
    task_date: Optional[dt_date] = Query(None, description="Конкретний день; без нього - усі"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Справи закладу. Доступні всьому персоналу: це спільний робочий
    список, а не особисті нотатки керівника."""
    from app.models import Task

    await assert_business_access(db, current_user, business_id)
    stmt = select(Task).where(Task.business_id == business_id)
    if task_date:
        stmt = stmt.where(Task.task_date == task_date)
    stmt = stmt.order_by(Task.completed, Task.created_at)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/crm/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    from app.models import Task

    await assert_business_access(db, current_user, payload.business_id)
    task = Task(**payload.model_dump(), created_by=current_user.id)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/crm/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    from app.models import Task

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Справу не знайдено")
    await assert_business_access(db, current_user, task.business_id)

    data = payload.model_dump(exclude_unset=True)
    if "completed" in data:
        # Час виконання фіксуємо разом зі статусом - інакше згодом
        # неможливо сказати, коли справу насправді закрили.
        task.completed_at = utc_now() if data["completed"] else None
    for field, value in data.items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/crm/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    from app.models import Task

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Справу не знайдено")
    await assert_business_access(db, current_user, task.business_id)

    # Справи видаляємо назовсім: на відміну від записів чи виплат, вони
    # не є фінансовою історією, тримати «скасовані справи» немає сенсу.
    await db.delete(task)
    await db.commit()


# === Розсилка клієнтам ===

class CampaignRequest(BaseModel):
    business_id: int
    subject: str = Field(..., min_length=3, max_length=150)
    message: str = Field(..., min_length=10, max_length=3000)
    # Кому: всі / лише постійні / лише ті, хто давно не був
    audience: str = Field("all", description="all | regular | lapsed")


async def _campaign_audience(db: AsyncSession, business_id: int, audience: str):
    """
    Кому піде розсилка: (усі клієнти закладу, ті, кому лист справді піде).
    Одне правило і для підрахунку перед відправкою, і для самої розсилки -
    число в інтерфейсі не може розійтись із фактом.
    """
    from app.models import Client
    from app.services.client_stats import client_stats
    from app.core.time_utils import local_now as _local_now

    clients = (await db.execute(select(Client).where(
        Client.business_id == business_id, Client.is_blacklisted.isnot(True),
    ))).scalars().all()
    # Візити й останній візит - із записів. Збережені лічильники ніхто не
    # оновлював: «постійним» не знаходилось нікого, а «давно не були»
    # падала на неіснуючому полі last_visit.
    stats = await client_stats(db, business_id, clients)
    today = _local_now().date()
    selected = []
    for c in clients:
        if not c.email:
            continue
        s = stats.get(c.id, {})
        if audience == "regular" and s.get("visits_count", 0) < 3:
            continue
        if audience == "lapsed":
            # «Давно не був» - понад 60 днів і без майбутнього запису. Тим,
            # хто був учора чи записаний на завтра, «ми скучили» - безглуздо.
            last = s.get("last_visit_at")
            if not last or s.get("next_visit_at") or (today - last.date()).days < 60:
                continue
        selected.append(c)
    return clients, selected


@router.get("/crm/campaigns/audience")
async def campaign_audience(
    business_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Скільки людей отримає розсилку для кожної аудиторії - до відправки."""
    await assert_section(db, current_user, business_id, "analytics")
    out = {}
    for key in ("all", "regular", "lapsed"):
        clients, selected = await _campaign_audience(db, business_id, key)
        out[key] = len(selected)
    out["total_clients"] = len(clients)
    out["without_email"] = sum(1 for c in clients if not c.email)
    return out


@router.post("/crm/campaigns")
async def send_campaign(
    payload: CampaignRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Надіслати листа клієнтам закладу.

    Раніше кнопка «Відправити» в маркетингу лише показувала
    повідомлення «Розсилку відправлено» - жоден лист нікуди не йшов.

    Обмеження свідомі:
    - лише адміністратори: розсилка від імені закладу впливає на
      репутацію, це не рішення рядового майстра
    - за підпискою: масова пошта - платна можливість
    - без email клієнта пропускаємо мовчки, але рахуємо: власник має
      бачити, скільки контактів насправді досяжні
    """
    from app.models import Business, Client
    from app.core.email import send_campaign_email

    await assert_section(db, current_user, payload.business_id, "analytics")

    biz_res = await db.execute(select(Business).where(Business.id == payload.business_id))
    business = biz_res.scalars().first()
    if not business:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    clients, selected = await _campaign_audience(db, payload.business_id, payload.audience)
    from app.services.audit import record as _audit
    audience_label = {"all": "усі", "regular": "постійні", "lapsed": "давно не були"}.get(payload.audience, payload.audience)
    await _audit(db, payload.business_id, str(current_user.id), "marketing", "campaign_sent",
                 f"Розсилка «{payload.subject[:80]}»: {len(selected)} листів (аудиторія: {audience_label})",
                 meta={"queued": len(selected), "audience": payload.audience})
    await db.commit()

    for c in selected:
        background_tasks.add_task(
            send_campaign_email,
            to_email=c.email,
            client_name=c.name or "",
            business_name=business.name,
            subject=payload.subject,
            message=payload.message,
        )

    return {
        "queued": len(selected),
        "total_clients": len(clients),
        "without_email": sum(1 for c in clients if not c.email),
    }
