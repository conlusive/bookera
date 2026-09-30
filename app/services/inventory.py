from decimal import Decimal
from typing import Optional

from app.core.time_utils import to_local
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import logger
from app.models import Appointment, InventoryItem, InventoryMovement, ServiceMaterial


async def _net_used(db: AsyncSession, appointment_id: int) -> dict:
    """
    Скільки кожного матеріалу ЗАРАЗ списано за цей візит: списання мінус
    повернення. Саме від цього, а не від факту колишнього списання,
    залежить, чи треба списувати чи повертати.
    """
    rows = (await db.execute(
        select(InventoryMovement.inventory_item_id, InventoryMovement.quantity_delta, InventoryMovement.cost_at_moment)
        .where(InventoryMovement.appointment_id == appointment_id,
               InventoryMovement.reason.in_(("service_usage", "revert")))
    )).all()
    net: dict = {}
    for item_id, delta, cost in rows:
        q, cst = net.get(item_id, (Decimal("0"), Decimal("0")))
        d = Decimal(str(delta or 0))
        # списання - від'ємне, повернення - додатне; вартість - з тим самим знаком
        net[item_id] = (q + d, cst + (Decimal(str(cost or 0)) if d < 0 else -Decimal(str(cost or 0))))
    return {k: v for k, v in net.items() if v[0] != 0}


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

    # Уже списано й не повернуто - удруге не списуємо. Раніше дивились на
    # сам факт колишнього списання: після «завершити -> повернути ->
    # завершити» матеріали вдруге не списувались.
    if await _net_used(db, appointment.id):
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
    # Повертаємо лише те, що ЗАРАЗ списано. Раніше поверталось кожне колишнє
    # списання, навіть уже повернене: «завершити -> скасувати -> завершити
    # -> скасувати» двічі додавало на склад те, чого немає.
    net = await _net_used(db, appointment.id)
    for item_id, (qty, cost) in net.items():
        if qty >= 0:
            continue
        item = (await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))).scalars().first()
        if not item:
            continue
        qty_back = -qty
        item.quantity = Decimal(str(item.quantity or 0)) + qty_back
        db.add(InventoryMovement(
            business_id=appointment.business_id,
            inventory_item_id=item.id,
            appointment_id=appointment.id,
            quantity_delta=qty_back,
            cost_at_moment=cost,
            reason="revert",
        ))

async def _sum_movement_cost(db: AsyncSession, appointment_id: int) -> Decimal:
    """Вартість матеріалів, списаних за візит зараз (списання мінус повернення)."""
    return sum((cost for _, cost in (await _net_used(db, appointment_id)).values()), Decimal("0"))

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
            # Межі - UTC, час візитів - місцевий (див. calculate_payout_preview)
            Appointment.start_time >= to_local(period_start),
            Appointment.start_time <= to_local(period_end),
        )
    )
    return sum((Decimal(str(c or 0)) for c in res.scalars().all()), Decimal("0"))
