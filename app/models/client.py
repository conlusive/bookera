from datetime import datetime, date

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Date, Numeric, Text, JSON
from sqlalchemy.orm import relationship

from app.core.time_utils import utc_now
from app.models.base import Base


class Client(Base):
    """
    CRM-контакт бізнесу. НЕ те саме, що User (платформа): клієнт може існувати
    в блокноті салону, навіть якщо ніколи не реєструвався в Bookera.
    Раніше писався напряму з фронтенду в Supabase (ClientsTab.tsx, CalendarTab.tsx)
    в обхід будь-якої валідації.
    """
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    linked_user_id = Column(String, ForeignKey("users.id"), nullable=True)  # якщо клієнт має акаунт

    name = Column(String, nullable=False)
    phone = Column(String, nullable=True, index=True)
    email = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    allergies = Column(Text, nullable=True)
    tags = Column(JSON, default=list)

    is_blacklisted = Column(Boolean, default=False)
    balance = Column(Numeric(10, 2), default=0)  # під майбутню фічу балів/балансу

    birthday = Column(Date, nullable=True)
    instagram = Column(String, nullable=True)
    formulas = Column(Text, nullable=True)  # рецепти фарби/формули процедур
    consent_photo = Column(Boolean, default=False, nullable=False)
    consent_procedure = Column(Boolean, default=False, nullable=False)

    visits_count = Column(Integer, default=0)
    total_spent = Column(Numeric(10, 2), default=0)
    last_visit_at = Column(DateTime, nullable=True)
    medical_pdf_url = Column(Text, nullable=True)

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    business = relationship("Business", back_populates="clients")
    appointments = relationship("Appointment", back_populates="client")
    links = relationship("ClientLink", foreign_keys="ClientLink.client_id", cascade="all, delete-orphan")

    @property
    def linked_client_ids(self) -> list:
        """Обчислюване поле для API-відповіді. Викликач має заздалегідь
        підвантажити links через selectinload, інакше впаде MissingGreenlet."""
        return [link.linked_client_id for link in self.links]


class ClientLink(Base):
    """Сімейні/пов'язані клієнтські картки (заміняє JSON linked_clients)."""
    __tablename__ = "client_links"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    linked_client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
