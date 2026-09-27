"""
Інструменти майстра: запити до салону й портфоліо.
"""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text

from app.models.base import Base
from app.core.time_utils import utc_now


class StaffRequest(Base):
    """
    Запит майстра до салону: змінити графік чи відпустка/лікарняний.

    Майстер просить - власник чи адміністратор погоджує в «Команді», і
    зміна застосовується сама:
      schedule - payload {"shifts": [7 днів]} -> графік майстра в закладі
      time_off - payload {"date_from", "date_to", "reason"} -> ці дні
                 закриваються для запису (постійні блоки)
    """
    __tablename__ = "staff_requests"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String, nullable=False)              # schedule | time_off
    status = Column(String, nullable=False, default="pending")  # pending | approved | declined | cancelled
    payload = Column(JSON, nullable=False)
    comment = Column(Text, nullable=True)              # від майстра
    response_note = Column(Text, nullable=True)        # від салону
    decided_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    decided_at = Column(DateTime, nullable=True)


class PortfolioItem(Base):
    """
    Фото роботи майстра. Клієнти бачать їх на сторінці салону, коли
    обирають, до кого записатись.
    """
    __tablename__ = "portfolio_items"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    image_url = Column(String, nullable=False)
    caption = Column(String, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
