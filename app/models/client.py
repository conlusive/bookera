from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Numeric, Text, JSON
from sqlalchemy.orm import relationship

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

    visits_count = Column(Integer, default=0)
    total_spent = Column(Numeric(10, 2), default=0)
    last_visit_at = Column(DateTime, nullable=True)
    medical_pdf_url = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="clients")
    appointments = relationship("Appointment", back_populates="client")


class ClientLink(Base):
    """Сімейні/пов'язані клієнтські картки (заміняє JSON linked_clients)."""
    __tablename__ = "client_links"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    linked_client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
