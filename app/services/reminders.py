"""
Нагадування клієнтам про візит.

Найдешевший спосіб зменшити неявки: людина записалась тиждень тому
й забула. Нагадування за добу дає їй час або прийти, або скасувати -
і друге теж цінне, бо слот ще можна віддати комусь іншому.

Чому вікно, а не точний час: процес прокидається раз на годину, і
шукати візити «рівно за 24 години» означало б пропускати всі, що
не потрапили в мить перевірки. Беремо діапазон від 20 до 28 годин
уперед - кожен візит гарантовано потрапить в одну з перевірок.

Чому reminder_sent_at, а не прапорець: із датою видно, чи лист пішов
вчасно, і можна розібратись, коли клієнт каже, що нічого не отримував.
"""
import asyncio
from datetime import timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import send_booking_reminder_email
from app.core.logging_config import logger
from app.core.time_utils import local_now, utc_now
from app.models import Appointment, Business, Service, User
from app.services.subscription import has_access

# Вікно пошуку. Ширше за годину прокидання, щоб жоден візит не
# провалився між перевірками.
WINDOW_START_HOURS = 20
WINDOW_END_HOURS = 28

CHECK_INTERVAL_SECONDS = 60 * 60

FRONTEND_URL_ENV = "FRONTEND_URL"


async def send_due_reminders(db: AsyncSession, frontend_url: str = "") -> int:
    """
    Знайти візити, до яких лишилась приблизно доба, і нагадати про них.

    Повертає кількість надісланих листів - зручно для логів і тестів.
    """
    # Без налаштованої пошти надсилати нічого: виходимо одразу, щоб
    # не робити марних запитів до бази щогодини.
    import os
    if not (os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD")):
        return 0

    now = utc_now()
    window_start = now + timedelta(hours=WINDOW_START_HOURS)
    window_end = now + timedelta(hours=WINDOW_END_HOURS)

    stmt = select(Appointment).where(
        Appointment.status == "confirmed",
        Appointment.start_time >= window_start,
        Appointment.start_time <= window_end,
        Appointment.reminder_sent_at.is_(None),
        Appointment.client_email.isnot(None),
    )
    result = await db.execute(stmt)
    appointments = result.scalars().all()

    sent = 0
    for appointment in appointments:
        biz_res = await db.execute(select(Business).where(Business.id == appointment.business_id))
        business = biz_res.scalars().first()
        if not business:
            continue

        # Заклад без чинної підписки не розсилає нічого: сервіс не
        # має працювати від його імені, поки не оплачений.
        if not has_access(business):
            continue

        # Нагадування можна вимкнути в налаштуваннях. Значення за
        # замовчуванням - увімкнено: заклади, які нічого не чіпали,
        # отримують корисну поведінку без зайвих дій.
        notify = business.notification_settings or {}
        if notify.get("notify_client_reminder_sms") is False:
            continue

        service = None
        if appointment.service_id:
            srv_res = await db.execute(select(Service).where(Service.id == appointment.service_id))
            service = srv_res.scalars().first()

        master_name = ""
        if appointment.master_id:
            m_res = await db.execute(select(User).where(User.id == str(appointment.master_id)))
            master = m_res.scalars().first()
            master_name = (master.full_name or "") if master else ""

        manage_url = ""
        if appointment.manage_token and frontend_url:
            manage_url = f"{frontend_url}/my-booking/{appointment.id}?token={appointment.manage_token}"

        try:
            await send_booking_reminder_email(
                to_email=appointment.client_email,
                client_name=appointment.client_name or "",
                business_name=business.name,
                service_name=service.name if service else "Візит",
                booking_date=appointment.start_time.strftime("%d.%m.%Y"),
                booking_time=appointment.start_time.strftime("%H:%M"),
                master_name=master_name,
                address=f"{business.city or ''}, {business.address or ''}",
                business_phone=business.phone or "",
                manage_url=manage_url,
            )
        except Exception as exc:
            # Один невдалий лист не має зупиняти решту: якщо в когось
            # некоректна адреса, інші клієнти все одно мають отримати
            # нагадування.
            logger.warning("Не вдалося надіслати нагадування (запис %s): %s", appointment.id, exc)
            continue

        # Позначаємо ПІСЛЯ успішної відправки. Якби позначали до неї,
        # збій пошти означав би, що клієнт не отримає нагадування
        # ніколи - повторної спроби вже не буде.
        appointment.reminder_sent_at = utc_now()
        sent += 1

    if sent:
        await db.commit()
        logger.info("Надіслано нагадувань: %s", sent)

    return sent


async def reminder_loop(session_factory, frontend_url: str = "") -> None:
    """
    Фоновий цикл. Запускається при старті застосунку.

    Кожна ітерація бере СВОЮ сесію бази: тримати одну відкритою
    годинами - вірний спосіб отримати обрив зʼєднання посеред роботи.

    Виняток усередині циклу не має його зупиняти: разова помилка
    (база перезавантажилась, мережа моргнула) не повинна вимикати
    нагадування до наступного перезапуску сервера.
    """
    while True:
        try:
            async with session_factory() as db:
                await send_due_reminders(db, frontend_url)
                # Завершення минулих візитів - у тому ж циклі: обидві
                # задачі періодичні, і другий фоновий процес заради
                # одного запиту раз на годину не вартий складності.
                await complete_past_appointments(db)
                await send_review_requests(db, frontend_url)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("Помилка в циклі нагадувань: %s", exc)

        await asyncio.sleep(CHECK_INTERVAL_SECONDS)


async def complete_past_appointments(db: AsyncSession) -> int:
    """
    Позначити завершеними візити, час яких минув.

    Раніше це робив ФРОНТЕНД при відкритті календаря. Наслідок: візити
    ставали завершеними лише коли хтось заходив у систему. Заклад не
    відкривав кабінет тиждень - тиждень записів висіли «підтвердженими»,
    і виплати майстрам рахувались неправильно, бо в розрахунок беруться
    саме завершені.

    Запас у 15 хвилин після кінця візиту: якщо клієнт затримався, а
    майстер ще не встиг натиснути «завершено», не варто робити це за
    нього тієї ж секунди.
    """
    # Час візитів - у поясі закладу (Київ). Раніше порівнювали з UTC, і
    # візити автоматично завершувались на 3 години пізніше.
    now = local_now().replace(tzinfo=None)
    cutoff = now - timedelta(minutes=15)

    stmt = select(Appointment).where(
        Appointment.status == "confirmed",
        Appointment.end_time < cutoff,
    )
    result = await db.execute(stmt)
    appointments = result.scalars().all()

    completed = 0
    for appointment in appointments:
        # Комісію нараховує та сама функція, що й при ручному завершенні:
        # два шляхи до одного стану неминуче розійшлися б, і частина
        # візитів лишилась би без комісії.
        biz_res = await db.execute(select(Business).where(Business.id == appointment.business_id))
        business = biz_res.scalars().first()

        _old_status = appointment.status
        appointment.status = "completed"
        # Бонуси BookEra: нарахувати за завершений візит або повернути,
        # якщо позначку «завершено» зняли.
        from app.services.bonuses import sync_visit_bonus
        await sync_visit_bonus(db, appointment, _old_status)
        completed += 1

        try:
            # Комісія й списання матеріалів - та сама функція, що в календарі
            # й CRM. Раніше тут була лише комісія: автозавершені візити не
            # списували матеріалів зі складу.
            from app.services.visit_hooks import on_status_change
            await on_status_change(db, appointment, _old_status, "completed")
        except Exception as exc:
            # Не блокує завершення: сам факт виконаної роботи важливіший.
            logger.warning("Комісія / матеріали не оброблені (запис %s): %s", appointment.id, exc)

    if completed:
        await db.commit()
        logger.info("Автоматично завершено візитів: %s", completed)

    return completed



# Лист - одразу після завершення візиту: враження найсвіжіші, а людина
# ще памʼятає і майстра, і салон окремо.
REVIEW_DELAY_HOURS = 0
REVIEW_MAX_AGE_DAYS = 3


async def send_review_requests(db: AsyncSession, frontend_url: str = "") -> int:
    """
    «Як вам візит?» - один лист одразу після завершеного візиту.

    Цей цикл - запасний шлях: для візитів, завершених автоматично за
    часом. Коли візит позначає майстер, лист іде миттєво (request_review_now).
    Лише один раз (review_requested_at) і лише якщо відгуку ще немає.
    Візити, старші за 3 дні (наприклад, після простою сервера), - не
    чіпаємо: запізнілий лист дратує більше, ніж його відсутність.
    """
    from app.core.email import send_review_request
    from app.models import Business, Service, User
    from app.models.extras import Review

    now = local_now().replace(tzinfo=None)
    rows = (await db.execute(select(Appointment).where(
        Appointment.status == "completed",
        Appointment.end_time <= now - timedelta(hours=REVIEW_DELAY_HOURS),
        Appointment.end_time >= now - timedelta(days=REVIEW_MAX_AGE_DAYS),
        Appointment.review_requested_at.is_(None),
        Appointment.client_email.isnot(None),
        Appointment.manage_token.isnot(None),
        ~select(Review.id).where(Review.appointment_id == Appointment.id).exists(),
    ).limit(200))).scalars().all()

    sent = 0
    base = (frontend_url or "").rstrip("/")
    for a in rows:
        a.review_requested_at = utc_now()
        try:
            biz = await db.get(Business, a.business_id)
            srv = await db.get(Service, a.service_id) if a.service_id else None
            master = (await db.execute(select(User).where(User.id == str(a.master_id)))).scalars().first() if a.master_id else None
            await send_review_request(
                a.client_email, biz.name if biz else "BookEra",
                (master.full_name or "").split(" ")[0] if master and master.full_name else "",
                srv.name if srv else "Візит", a.start_time.strftime("%d.%m, %H:%M"),
                f"{base}/my-booking/{a.id}?token={a.manage_token}",
            )
            sent += 1
        except Exception as exc:
            logger.warning("Лист «Як вам візит?» для %s не надіслано: %s", a.id, exc)
    await db.commit()
    return sent



async def request_review_now(db: AsyncSession, appointment, frontend_url: str = "") -> Optional[tuple]:
    """
    Миттєвий «Як вам візит?» - коли майстер позначив візит завершеним.

    Повертає аргументи для фонового листа (або None) і ставить
    review_requested_at у поточну транзакцію, щоб цикл не надіслав удруге.
    Викликати ДО commit, лист - через background_tasks ПІСЛЯ.
    """
    import os
    from app.models import Business, Service, User
    from app.models.extras import Review

    a = appointment
    if a.status != "completed" or a.review_requested_at or not a.client_email or not a.manage_token:
        return None
    now = local_now().replace(tzinfo=None)
    if a.end_time and now - a.end_time > timedelta(days=REVIEW_MAX_AGE_DAYS):
        return None  # старий візит, позначений заднім числом, - без листа
    if (await db.execute(select(Review.id).where(Review.appointment_id == a.id))).first():
        return None
    a.review_requested_at = utc_now()
    biz = await db.get(Business, a.business_id)
    srv = await db.get(Service, a.service_id) if a.service_id else None
    master = (await db.execute(select(User).where(User.id == str(a.master_id)))).scalars().first() if a.master_id else None
    base = (frontend_url or os.getenv("FRONTEND_URL", "")).rstrip("/")
    return (
        a.client_email, biz.name if biz else "BookEra",
        (master.full_name or "").split(" ")[0] if master and master.full_name else "",
        srv.name if srv else "Візит", a.start_time.strftime("%d.%m, %H:%M"),
        f"{base}/my-booking/{a.id}?token={a.manage_token}",
    )
