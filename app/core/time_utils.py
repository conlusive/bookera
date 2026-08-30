from datetime import datetime, timezone


def utc_now() -> datetime:
    """
    Naive UTC datetime (без tzinfo) - узгоджено зі стовпцями типу
    TIMESTAMP WITHOUT TIME ZONE в базі. Раніше ця сама логіка була
    продубльована в трьох різних файлах (і подекуди застарілим,
    депрекейтнутим datetime.utcnow()) - тепер єдине джерело правди.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
