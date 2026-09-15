from datetime import datetime, timezone
from zoneinfo import ZoneInfo

DEFAULT_TIMEZONE = "Europe/Kyiv"

def get_business_now(tz_name: str | None = None) -> datetime:
    """Повертає поточний час у часовому поясі салону."""
    tz_str = tz_name or DEFAULT_TIMEZONE
    try:
        tz = ZoneInfo(tz_str)
    except Exception:
        tz = ZoneInfo(DEFAULT_TIMEZONE)
    return datetime.now(tz)

def utc_now() -> datetime:
    """
    Naive UTC datetime (без tzinfo) - узгоджено зі стовпцями типу
    TIMESTAMP WITHOUT TIME ZONE в базі. Раніше ця сама логіка була
    продубльована в трьох різних файлах (і подекуди застарілим,
    депрекейтнутим datetime.utcnow()) - тепер єдине джерело правди.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
