import re
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import logger
from app.core.time_utils import utc_now
from app.models import Appointment, Business, Client, PointsLedgerEntry, PointsReasonEnum, ReferralCommission

POINTS_PER_NEW_CLIENT = 10
# Комісія платформи з завершеного візиту, що прийшов із вітрини (власні клієнти її не мають)
DEFAULT_COMMISSION_RATE = Decimal("10.00")
# Скільки днів після переходу за прямим посиланням закладу клієнт лишається «власним»
# (браузер забуває токен пізніше; число віддається фронтенду через /businesses/platform-terms)
DIRECT_LINK_DAYS = 30
# Картка клієнта, створена не онлайн-записом і раніше за запис, - клієнт закладу, а не вітрини.
# Невеликий запас: картку онлайн-запису сервер створює майже одночасно з самим записом.
_OWN_CARD_GRACE = timedelta(minutes=2)
ONLINE_TAG = "Онлайн-запис"


def _phone_tail(phone: Optional[str]) -> Optional[str]:
    digits = re.sub(r"\D", "", phone or "")
    return digits[-9:] if len(digits) >= 9 else None


def _identity_filters(model, appointment: Appointment) -> list:
    """Умови «це та сама людина»: картка/запис за client_id, останніми 9 цифрами телефону чи поштою."""
    conds = []
    if getattr(appointment, "client_id", None) is not None:
        conds.append(model.client_id == appointment.client_id if hasattr(model, "client_id") else model.id == appointment.client_id)
    tail = _phone_tail(appointment.client_phone)
    phone_col = model.client_phone if hasattr(model, "client_phone") else model.phone
    email_col = model.client_email if hasattr(model, "client_email") else model.email
    if tail:
        conds.append(func.right(func.regexp_replace(phone_col, r"\D", "", "g"), 9) == tail)
    if appointment.client_email:
        conds.append(func.lower(email_col) == appointment.client_email.strip().lower())
    return conds


async def is_own_client(db: AsyncSession, appointment: Appointment) -> bool:
    """
    Чи цей клієнт уже був клієнтом закладу ДО візиту. Тоді вітрина його не «привела» і комісії немає.

    Власний, якщо:
      1) у закладі вже є ІНШИЙ завершений візит цієї людини (з будь-якого джерела), або
      2) її картка в закладі існувала раніше за запис і створена НЕ онлайн-записом
         (внесена вручну, імпортована, з розсилки).
    Людину знаходимо за client_id, останніми 9 цифрами телефону чи поштою.
    """
    visit_conds = _identity_filters(Appointment, appointment)
    if visit_conds:
        prior = await db.execute(
            select(Appointment.id).where(
                Appointment.business_id == appointment.business_id,
                Appointment.status == "completed",
                Appointment.id != appointment.id,
                or_(*visit_conds),
            ).limit(1)
        )
        if prior.scalars().first() is not None:
            return True

    card_conds = _identity_filters(Client, appointment)
    if card_conds and appointment.created_at is not None:
        cards = await db.execute(
            select(Client).where(Client.business_id == appointment.business_id, or_(*card_conds))
        )
        for card in cards.scalars().all():
            if card.created_at is not None and card.created_at < appointment.created_at - _OWN_CARD_GRACE \
                    and ONLINE_TAG not in (card.tags or []):
                return True
    return False


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


OWED_STATUSES = ("pending", "invoiced")


async def owed_commissions(db: AsyncSession, business_id: int, lock: bool = False) -> list:
    """Неоплачені комісії закладу: нараховані й виставлені в платежі, що ще не підтверджений."""
    stmt = select(ReferralCommission).where(
        ReferralCommission.business_id == business_id, ReferralCommission.status.in_(OWED_STATUSES)
    )
    if lock:
        stmt = stmt.with_for_update()
    return list((await db.execute(stmt)).scalars().all())


def commissions_total(rows: list) -> Decimal:
    return sum((Decimal(r.amount) for r in rows), Decimal("0")).quantize(Decimal("0.01"))


async def attach_commissions(db: AsyncSession, rows: list, payment) -> None:
    """Прив'язує комісії до платежу, що їх покриває (виставлено, ще не сплачено)."""
    for r in rows:
        r.payment_id = payment.id
        r.status = "invoiced"
    await db.flush()  # сесія без autoflush: наступні вибірки за payment_id мають бачити зміни


async def settle_commissions(db: AsyncSession, payment) -> None:
    """Платіж підтверджено: усе, що в ньому виставлено, стає сплаченим. Повтор нічого не змінює."""
    rows = (await db.execute(select(ReferralCommission).where(ReferralCommission.payment_id == payment.id))).scalars().all()
    for r in rows:
        r.status = "paid"


async def charge_commission_if_applicable(db: AsyncSession, appointment: Appointment, business: Business) -> None:
    """
    Викликається, коли запис переходить у статус 'completed'. Комісія
    нараховується лише за НОВОГО клієнта закладу, що прийшов з вітрини Bookera
    (source == 'marketplace'), і лише за його перший завершений візит.
    Власні клієнти - за прямим посиланням, з розсилки, внесені вручну, а також
    ті, хто вже відвідував заклад, - безкоштовні завжди, навіть якщо записались
    через вітрину: платформа не приводила їх, вони вже були в закладі.

    Радар - це окрема плата за показ, а не друга комісія: раніше, поки
    пакет був активний, 10% стягувалось з УСІХ візитів закладу, тобто
    власник платив двічі й за власних клієнтів теж.
    """
    if appointment.source != "marketplace":
        return  # не з вітрини - комісії немає

    already = await db.execute(
        select(ReferralCommission.id).where(ReferralCommission.appointment_id == appointment.id)
    )
    if already.scalars().first() is not None:
        return  # не нараховуємо двічі (напр. якщо статус змінили туди-сюди)

    if not appointment.price:
        return

    if await is_own_client(db, appointment):
        return  # уже клієнт закладу - вітрина його не привела

    rate = business.commission_rate or DEFAULT_COMMISSION_RATE
    amount = (Decimal(str(appointment.price)) * rate / Decimal("100")).quantize(Decimal("0.01"))

    db.add(
        ReferralCommission(
            business_id=business.id,
            appointment_id=appointment.id,
            amount=amount,
            rate_applied=rate,
            reason="marketplace_source",
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

    # status != 'cancelled' - принципово: скасована виплата НЕ закриває
    # період, тому візити з неї повертаються в наступний розрахунок.
    # Без цієї умови гроші за них зникли б після скасування.
    # Майстра завантажуємо ПЕРШИМ: від нього залежить початок періоду
    # (момент налаштування оплати).
    staff_res = await db.execute(select(User).where(User.id == staff_id))
    staff = staff_res.scalars().first()

    last_payout_res = await db.execute(
        select(StaffPayout)
        .where(
            StaffPayout.business_id == business_id,
            StaffPayout.staff_id == staff_id,
            StaffPayout.status != "cancelled",
        )
        .order_by(StaffPayout.period_end.desc())
        .limit(1)
    )
    last_payout = last_payout_res.scalars().first()

    if last_payout:
        period_start = last_payout.period_end
    else:
        biz_res = await db.execute(select(Business).where(Business.id == business_id))
        business = biz_res.scalars().first()
        # Від моменту, коли оплату налаштували, а не від реєстрації
        # закладу: до налаштування умов оплати не існувало.
        period_start = (staff.pay_configured_at if staff and staff.pay_configured_at else None) \
            or (business.created_at if business else utc_now())

    period_end = utc_now()

    rate = (staff.commission_rate if staff and staff.commission_rate is not None else Decimal("0"))

    # Межі періоду зберігаються в UTC, а час візитів - у поясі закладу
    # (Київ, +3 год). Порівнювати їх напряму не можна: візити за останні
    # 3 години не потрапляли у виплату, а візит за 3 години до попередньої
    # виплати потрапляв і в неї, і в наступну - двічі. Переводимо межі в
    # місцевий час перед порівнянням.
    from app.core.time_utils import to_local
    appts_stmt = select(Appointment).where(
        Appointment.business_id == business_id,
        Appointment.master_id == staff_id,
        Appointment.status == "completed",
        Appointment.start_time >= to_local(period_start),
        Appointment.start_time <= to_local(period_end),
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

    # Вартість матеріалів віднімається, лише якщо для майстра увімкнено
    # відповідну опцію в картці - інакше показуємо її просто для інформації.
    from app.services.inventory import materials_cost_for_period
    materials_cost = await materials_cost_for_period(db, business_id, staff_id, period_start, period_end)
    if staff and staff.deduct_materials:
        subtotal = subtotal - materials_cost

    tax_rate = Decimal(str(staff.tax_rate)) if staff and staff.tax_rate else Decimal("0")
    tax_amount = (subtotal * tax_rate / Decimal("100")).quantize(Decimal("0.01"))

    payout_amount = (subtotal - tax_amount).quantize(Decimal("0.01"))
    if payout_amount < 0:
        payout_amount = Decimal("0.00")

    # Чайові - майстрові повністю, якщо так налаштовано (tips_full, типово
    # так). Після податку: це не дохід закладу, а подяка клієнта майстрові.
    tips_amount = sum((Decimal(str(a.tip_amount)) for a in appointments if a.tip_amount), Decimal("0"))
    if staff is not None and getattr(staff, "tips_full", True) and tips_amount > 0:
        payout_amount = (payout_amount + tips_amount).quantize(Decimal("0.01"))

    return {
        "staff_id": staff_id,
        "period_start": period_start,
        "period_end": period_end,
        "commission_part": commission_part,
        "fixed_part": fixed_part,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "materials_cost": materials_cost,
        "materials_deducted": bool(staff and staff.deduct_materials),
        "gross_revenue": gross_revenue,
        "tips_amount": tips_amount,
        "commission_rate": rate,
        "payout_amount": payout_amount,
        "completed_appointments_count": len(appointments),
    }
