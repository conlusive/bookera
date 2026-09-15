from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def utc_now() -> datetime:
    """
    Naive UTC datetime (без tzinfo) - узгоджено зі стовпцями типу
    TIMESTAMP WITHOUT TIME ZONE в базі. Раніше ця сама логіка була
    продубльована в трьох різних файлах (і подекуди застарілим,
    депрекейтнутим datetime.utcnow()) - тепер єдине джерело правди.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


# Часова зона за замовчуванням.
#
# Система зберігає час у UTC, а заклад живе у своєму поясі. Влітку
# різниця з Києвом - 3 години, і без перетворення виходило три
# помилки одразу: минулі слоти показувались вільними, робочі години
# суботи не збігались із суботою за UTC, а «найближче вікно»
# рахувалось від UTC-часу.
DEFAULT_TIMEZONE = "Europe/Kyiv"


def business_tz(business=None) -> ZoneInfo:
    """
    Часовий пояс закладу. Поки одна зона на всю систему - але параметр
    уже приймаємо, щоб при виході за межі України не переписувати
    кожен виклик.
    """
    name = getattr(business, "timezone", None) or DEFAULT_TIMEZONE
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo(DEFAULT_TIMEZONE)


def local_now(business=None) -> datetime:
    """
    Поточний час У ПОЯСІ ЗАКЛАДУ, naive - щоб порівнювати з часом
    слотів, який теж naive і теж локальний.
    """
    return datetime.now(business_tz(business)).replace(tzinfo=None)


def to_utc(local_dt: datetime, business=None) -> datetime:
    """Локальний час закладу -> naive UTC для зберігання в базі."""
    if local_dt.tzinfo is not None:
        return local_dt.astimezone(timezone.utc).replace(tzinfo=None)
    return local_dt.replace(tzinfo=business_tz(business)).astimezone(timezone.utc).replace(tzinfo=None)


def to_local(utc_dt: datetime, business=None) -> datetime:
    """Naive UTC із бази -> локальний час закладу, теж naive."""
    if utc_dt.tzinfo is None:
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)
    return utc_dt.astimezone(business_tz(business)).replace(tzinfo=None)
