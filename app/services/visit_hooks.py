"""
Що має статися, коли візит стає завершеним (або перестає ним бути) -
ОДНЕ місце для всіх шляхів:
  - календар кабінету      (PATCH /appointments/{id}/status)
  - CRM                    (PATCH /crm/appointments/{id})
  - автозавершення за часом (services/reminders.complete_past_appointments)

Раніше комісія платформи й списання матеріалів були лише в першому.
Візити, завершені автоматично чи через CRM, не списували матеріалів
і не нараховували комісію.

Обидві дії безпечні для повторного виклику.
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, Business
from app.services.inventory import consume_materials_for_appointment, revert_materials_for_appointment
from app.services.monetization import charge_commission_if_applicable


async def on_status_change(db: AsyncSession, appointment: Appointment, old_status, new_status) -> None:
    old = str(getattr(old_status, "value", old_status) or "")
    new = str(getattr(new_status, "value", new_status) or "")
    if new == "completed" and old != "completed":
        business = await db.get(Business, appointment.business_id)
        if business:
            await charge_commission_if_applicable(db, appointment, business)
        await consume_materials_for_appointment(db, appointment)
    elif old == "completed" and new != "completed":
        # Помилково позначили завершеним - матеріали назад на склад
        await revert_materials_for_appointment(db, appointment)
