from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import logger
from app.models import Appointment, InventoryItem, InventoryMovement, ServiceMaterial


async def consume_materials_for_appointment(db: AsyncSession, appointment: Appointment) -> Decimal:
    """
    Списує зі складу матеріали, потрібні для послуги цього візиту, і повертає
    їхню сумарну вартість.

    Викликається, коли візит переходить у 'completed'. Ідемпотентна: якщо для
    цього візиту рух уже записаний, повторно нічого не списує - інакше зміна
    статусу туди-сюди щоразу зʼїдала б залишки.

    Залишок дозволяється піти в мінус: реальність важливіша за валідацію -
    майстер уже витратив матеріал, і краще показати від'ємний залишок як
    сигнал "терміново замовити", ніж мовчки не списати.
    """
    if not appointment.service_id:
        return Decimal("0")

    existing = await db.execute(
        select(InventoryMovement.id).where(
            InventoryMovement.appointment_id == appointment.id,
            InventoryMovement.reason == "service_usage",
        ).limit(1)
    )
    if existing.scalars().first() is not None:
        return await _sum_movement_cost(db, appointment.id)

    materials_res = await db.execute(
        select(ServiceMaterial).where(ServiceMaterial.service_id == appointment.service_id)
    )
    materials = materials_res.scalars().all()
    if not materials:
        return Decimal("0")

    total_cost = Decimal("0")
    for material in materials:
        item_res = await db.execute(
            select(InventoryItem).where(InventoryItem.id == material.inventory_item_id)
        )
        item = item_res.scalars().first()
        if not item:
            continue

        qty = Decimal(str(material.quantity_per_use or 0))
        unit_cost = Decimal(str(item.cost_per_unit or 0))
        cost = (qty * unit_cost).quantize(Decimal("0.01"))
        total_cost += cost

        item.quantity = Decimal(str(item.quantity or 0)) - qty
        db.add(InventoryMovement(
            business_id=appointment.business_id,
            inventory_item_id=item.id,
            appointment_id=appointment.id,
            quantity_delta=-qty,
            cost_at_moment=cost,
            reason="service_usage",
        ))

        if item.low_stock_threshold is not None and item.quantity <= Decimal(str(item.low_stock_threshold)):
            logger.warning(
                f"Залишок '{item.name}' опустився до {item.quantity} {item.unit} "
                f"(поріг {item.low_stock_threshold}) - business_id={item.business_id}"
            )

    return total_cost


async def revert_materials_for_appointment(db: AsyncSession, appointment: Appointment) -> None:
    """
    Повертає матеріали на склад, якщо завершений візит скасували.
    Без цього скасування помилково завершеного візиту назавжди
    "з'їдало" залишки.
    """
    movements_res = await db.execute(
        select(InventoryMovement).where(
            InventoryMovement.appointment_id == appointment.id,
            InventoryMovement.reason == "service_usage",
        )
    )
    movements = movements_res.scalars().all()
    if not movements:
        return

    for movement in movements:
        item_res = await db.execute(
            select(InventoryItem).where(InventoryItem.id == movement.inventory_item_id)
        )
        item = item_res.scalars().first()
        if not item:
            continue

        qty_back = -Decimal(str(movement.quantity_delta))
        item.quantity = Decimal(str(item.quantity or 0)) + qty_back
        db.add(InventoryMovement(
            business_id=movement.business_id,
            inventory_item_id=item.id,
            appointment_id=appointment.id,
            quantity_delta=qty_back,
            cost_at_moment=movement.cost_at_moment,
            reason="revert",
        ))


async def _sum_movement_cost(db: AsyncSession, appointment_id: int) -> Decimal:
    res = await db.execute(
        select(InventoryMovement.cost_at_moment).where(
            InventoryMovement.appointment_id == appointment_id,
            InventoryMovement.reason == "service_usage",
        )
    )
    return sum((Decimal(str(c or 0)) for c in res.scalars().all()), Decimal("0"))


async def materials_cost_for_period(
    db: AsyncSession, business_id: int, staff_id: str, period_start, period_end
) -> Decimal:
    """Сумарна вартість матеріалів, витрачених майстром за період."""
    res = await db.execute(
        select(InventoryMovement.cost_at_moment)
        .join(Appointment, Appointment.id == InventoryMovement.appointment_id)
        .where(
            InventoryMovement.business_id == business_id,
            InventoryMovement.reason == "service_usage",
            Appointment.master_id == staff_id,
            Appointment.start_time >= period_start,
            Appointment.start_time <= period_end,
        )
    )
    return sum((Decimal(str(c or 0)) for c in res.scalars().all()), Decimal("0"))
