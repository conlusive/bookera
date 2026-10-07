from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, String

from app.core.time_utils import utc_now
from app.models.base import Base


class Promotion(Base):
    """
    Акція закладу: знижка у відсотках на одну, кілька чи всі послуги, у певні дні тижня й години.
    Приклади: «−10% на манікюр»; «щодня з 8:00 до 10:00 − 50%» (години вказують ПОЧАТОК візиту).
    Знижку рахує сервер при записі (app/services/promotions.py) - клієнт лише бачить результат.
    """
    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(80), nullable=False)
    discount_percent = Column(Integer, nullable=False)
    service_ids = Column(JSON, nullable=True)   # None - усі послуги
    weekdays = Column(JSON, nullable=True)      # 0=Пн..6=Нд; None - щодня
    time_from = Column(String(5), nullable=True)  # "HH:MM"; разом із time_to, або обидва порожні
    time_to = Column(String(5), nullable=True)
    date_from = Column(Date, nullable=True)
    date_to = Column(Date, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=utc_now)
