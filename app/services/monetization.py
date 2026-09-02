from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import logger
from app.core.time_utils import utc_now
from app.models import Appointment, Business, Client, PointsLedgerEntry, PointsReasonEnum, ReferralCommission

POINTS_PER_NEW_CLIENT = 10


async def award_points_for_new_client(
    db: AsyncSession, business: Business, phone: Optional[str], new_client_id: Optional[int]
) -> None:
    """
    Нараховує бали бізнесу, якщо доданий клієнт - НОВИЙ для всієї екосистеми
    Bookera (жоден інший заклад ще не мав контакту з таким телефоном).
    Викликається одразу ПІСЛЯ створення Client - не раніше, інакше
    перевірка "чи є вже такий телефон" зловить щойно вставлений рядок сам себе.
    """
    if not phone:
        return

    existing = await db.execute(
        select(Client.id).where(Client.phone == phone, Client.id != new_client_id).limit(1)
    )
    if existing.scalars().first() is not None:
        return  # цей телефон вже десь був у системі - не новий для екосистеми

    business.points_balance = (business.points_balance or 0) + POINTS_PER_NEW_CLIENT
    db.add(
        PointsLedgerEntry(
            business_id=business.id,
            amount=POINTS_PER_NEW_CLIENT,
            reason=PointsReasonEnum.NEW_CLIENT_REFERRED.value,
            reference_client_id=new_client_id,
            balance_after=business.points_balance,
        )
    )
    logger.info(f"Нараховано {POINTS_PER_NEW_CLIENT} балів business_id={business.id} за нового клієнта")


async def charge_commission_if_applicable(db: AsyncSession, appointment: Appointment, business: Business) -> None:
    """
    Викликається, коли запис переходить у статус 'completed'. Комісія
    нараховується, якщо клієнт прийшов з маркетплейсу АБО поки в закладу
    активний radar-буст (тоді комісія йде з усіх записів, це і є ціна буста).
    """
    from app.models import RadarBoost  # локальний імпорт, щоб уникнути циклу

    radar_res = await db.execute(
        select(RadarBoost).where(
            RadarBoost.business_id == business.id,
            RadarBoost.status == "active",
            RadarBoost.expires_at > utc_now(),
        )
    )
    radar_active = radar_res.scalars().first() is not None

    is_marketplace = appointment.source == "marketplace"
    if not is_marketplace and not radar_active:
        return  # прямий клієнт, radar не активний - комісії немає

    already = await db.execute(
        select(ReferralCommission.id).where(ReferralCommission.appointment_id == appointment.id)
    )
    if already.scalars().first() is not None:
        return  # не нараховуємо двічі (напр. якщо статус змінили туди-сюди)

    if not appointment.price:
        return

    rate = business.commission_rate or Decimal("10.00")
    amount = (Decimal(str(appointment.price)) * rate / Decimal("100")).quantize(Decimal("0.01"))

    db.add(
        ReferralCommission(
            business_id=business.id,
            appointment_id=appointment.id,
            amount=amount,
            rate_applied=rate,
            reason="radar_active" if radar_active else "marketplace_source",
        )
    )
    logger.info(f"Нараховано комісію {amount} UAH business_id={business.id} appointment_id={appointment.id}")


async def calculate_payout_preview(db: AsyncSession, business_id: int, staff_id: str) -> dict:
    """
    Рахує, скільки належить майстру за завершені візити з часу ОСТАННЬОЇ
    виплати (щоб той самий візит ніколи не увійшов у дві виплати підряд).
    Якщо виплат ще не було - період починається з дати створення закладу.
    """
    from app.models import StaffPayout, User

    last_payout_res = await db.execute(
        select(StaffPayout)
        .where(StaffPayout.business_id == business_id, StaffPayout.staff_id == staff_id)
        .order_by(StaffPayout.period_end.desc())
        .limit(1)
    )
    last_payout = last_payout_res.scalars().first()

    if last_payout:
        period_start = last_payout.period_end
    else:
        biz_res = await db.execute(select(Business).where(Business.id == business_id))
        business = biz_res.scalars().first()
        period_start = business.created_at if business else utc_now()

    period_end = utc_now()

    staff_res = await db.execute(select(User).where(User.id == staff_id))
    staff = staff_res.scalars().first()
    rate = (staff.commission_rate if staff and staff.commission_rate is not None else Decimal("0"))

    appts_stmt = select(Appointment).where(
        Appointment.business_id == business_id,
        Appointment.master_id == staff_id,
        Appointment.status == "completed",
        Appointment.start_time >= period_start,
        Appointment.start_time <= period_end,
    )
    appts_res = await db.execute(appts_stmt)
    appointments = appts_res.scalars().all()

    gross_revenue = sum((Decimal(str(a.price)) for a in appointments if a.price), Decimal("0"))

    # Повна формула оплати праці, як її показує CRM:
    #   (відсоток від виручки + фіксована ставка) - податок/утримання
    # Раніше рахувався ЛИШЕ відсоток: якщо майстру поставили оклад,
    # до виплати показувало 0, хоча в картці стояла ставка.
    commission_part = (gross_revenue * rate / Decimal("100")).quantize(Decimal("0.01"))
    fixed_part = Decimal(str(staff.fixed_salary)) if staff and staff.fixed_salary else Decimal("0")
    subtotal = commission_part + fixed_part

    tax_rate = Decimal(str(staff.tax_rate)) if staff and staff.tax_rate else Decimal("0")
    tax_amount = (subtotal * tax_rate / Decimal("100")).quantize(Decimal("0.01"))

    payout_amount = (subtotal - tax_amount).quantize(Decimal("0.01"))
    if payout_amount < 0:
        payout_amount = Decimal("0.00")

    return {
        "staff_id": staff_id,
        "period_start": period_start,
        "period_end": period_end,
        "commission_part": commission_part,
        "fixed_part": fixed_part,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "gross_revenue": gross_revenue,
        "commission_rate": rate,
        "payout_amount": payout_amount,
        "completed_appointments_count": len(appointments),
    }
