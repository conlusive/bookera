"""
Відповідь закладу на запит клієнта (режим «підтверджую записи вручну»).

Статус pending_approval -> confirmed або cancelled змінюється з двох місць (календар кабінету й CRM-маршрут), і в обох клієнт
має отримати лист. Налаштування «Лист клієнту» (notify_client_booking) вимикає й ці листи.
"""
import os
from typing import Optional

from sqlalchemy import select

from app.models import Appointment, Business, Service, User

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


async def schedule_decision_email(db, background_tasks, appointment: Appointment, old_status: str, new_status: str) -> bool:
    """Ставить у чергу лист клієнту, якщо запит розглянули. Повертає, чи поставлено."""
    if old_status != "pending_approval" or new_status not in ("confirmed", "cancelled"):
        return False
    if not appointment.client_email:
        return False
    business: Optional[Business] = (await db.execute(select(Business).where(Business.id == appointment.business_id))).scalars().first()
    if not business or (business.notification_settings or {}).get("notify_client_booking", True) is False:
        return False
    service = (await db.execute(select(Service).where(Service.id == appointment.service_id))).scalars().first() if appointment.service_id else None
    master_name = ""
    if appointment.master_id:
        m = (await db.execute(select(User).where(User.id == str(appointment.master_id)))).scalars().first()
        master_name = (m.full_name or "") if m else ""
    from app.core.email import send_booking_decision_email
    background_tasks.add_task(
        send_booking_decision_email,
        to_email=appointment.client_email,
        approved=new_status == "confirmed",
        client_name=appointment.client_name or "Клієнт",
        business_name=business.name,
        service_name=service.name if service else "Візит",
        booking_date=appointment.start_time.strftime("%d.%m.%Y"),
        booking_time=appointment.start_time.strftime("%H:%M"),
        manage_url=f"{FRONTEND_URL}/my-booking/{appointment.id}?token={appointment.manage_token}" if appointment.manage_token else "",
        master_name=master_name,
        address=f"{business.city}, {business.address or ''}",
        business_phone=business.phone or "",
    )
    return True
