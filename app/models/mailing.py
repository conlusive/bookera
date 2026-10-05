from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from app.core.time_utils import utc_now
from app.models.base import Base


class EmailSuppression(Base):
    """
    Хто відписався від розсилок закладу. Пошта зберігається в нижньому регістрі.

    Діє на рівні закладу: людина, що відписалась від одного салону, не перестає
    отримувати листи про свої записи (вони не розсилка) і розсилки інших закладів.
    """
    __tablename__ = "email_suppressions"
    __table_args__ = (UniqueConstraint("business_id", "email", name="uq_email_suppression"),)

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String, nullable=False, index=True)
    source = Column(String, nullable=False, default="unsubscribe")  # unsubscribe | manual
    created_at = Column(DateTime, nullable=False, default=utc_now)


class EmailCampaign(Base):
    """Одна розсилка: хто й коли надіслав, скільки листів, скільки дійшло. Також - основа добових лімітів."""
    __tablename__ = "email_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(String, nullable=True)
    subject = Column(String, nullable=False)
    audience = Column(String, nullable=False, default="all")
    recipients = Column(Integer, nullable=False, default=0)
    sent = Column(Integer, nullable=False, default=0)
    failed = Column(Integer, nullable=False, default=0)
    status = Column(String, nullable=False, default="queued")  # queued | sending | done
    created_at = Column(DateTime, nullable=False, default=utc_now, index=True)
    finished_at = Column(DateTime, nullable=True)
