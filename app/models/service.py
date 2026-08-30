from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Numeric, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.time_utils import utc_now
from app.models.base import Base


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    duration_minutes = Column(Integer, default=60)
    is_group = Column(Boolean, default=False)
    max_participants = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)

    business = relationship("Business", back_populates="services")
    appointments = relationship("Appointment", back_populates="service")
    addons = relationship(
        "Service",
        secondary="service_addons",
        primaryjoin="Service.id==ServiceAddon.service_id",
        secondaryjoin="Service.id==ServiceAddon.addon_service_id",
    )

    @property
    def addon_service_ids(self) -> list:
        """Обчислюване поле для API-відповіді - список id зі зв'язку `addons`.
        Викликач має заздалегідь підвантажити addons через selectinload,
        інакше звернення сюди поза async-сесією впаде з MissingGreenlet."""
        return [s.id for s in self.addons]


class ServiceAddon(Base):
    """
    Замінює JSON-поле services.addon_service_ids. Проста таблиця зв'язку
    замість вільного списку id - тепер видалення послуги коректно прибирає
    і всі посилання на неї як на допослугу (ondelete='CASCADE' в міграції).
    """
    __tablename__ = "service_addons"
    __table_args__ = (UniqueConstraint("service_id", "addon_service_id", name="uq_service_addon"),)

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False)
    addon_service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False)
