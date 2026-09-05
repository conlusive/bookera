from datetime import datetime, date as dt_date

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Numeric, Text, SmallInteger, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.time_utils import utc_now
from app.models.base import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    author_name = Column(String, nullable=True)
    rating = Column(SmallInteger, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    business_reply = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    business = relationship("Business", back_populates="reviews")
    appointment = relationship("Appointment", back_populates="review")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    name = Column(String, nullable=False)
    quantity = Column(Numeric(10, 2), default=0)
    unit = Column(String, default="шт")
    low_stock_threshold = Column(Numeric(10, 2), nullable=True)
    cost_per_unit = Column(Numeric(10, 2), nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    business = relationship("Business", back_populates="inventory_items")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    category = Column(String, nullable=True)
    description = Column(String, nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    expense_date = Column(Date, default=dt_date.today, nullable=False)

    # "none" / "weekly" / "monthly". recurrence_group_id об'єднує ВСІ майбутні
    # входження одного повторюваного платежу - раніше фронтенд шукав "майбутні
    # входження" зіставленням за текстом (category+description), що ламалось,
    # якщо два різні повторювані платежі мали однакову назву й категорію.
    recurrence = Column(String, default="none", nullable=False)
    recurrence_group_id = Column(String, nullable=True, index=True)

    created_at = Column(DateTime, default=utc_now)

    business = relationship("Business", back_populates="expenses")


class ServiceMaterial(Base):
    """
    Скільки матеріалу зі складу витрачається на одну послугу.
    Потрібно для двох речей: автоматичного списання зі складу при
    завершенні візиту і опції "вираховувати вартість матеріалів"
    при розрахунку зарплати майстра.
    """
    __tablename__ = "service_materials"
    __table_args__ = (UniqueConstraint("service_id", "inventory_item_id", name="uq_service_material"),)

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False)
    quantity_per_use = Column(Numeric(10, 3), nullable=False, default=1)

    created_at = Column(DateTime, default=utc_now)

    inventory_item = relationship("InventoryItem")


class InventoryMovement(Base):
    """
    Історія руху складу. Без неї списання було б "невидимим": залишок
    змінюється, а чому - незрозуміло. Також дозволяє повернути матеріали
    назад, якщо візит скасували після завершення.
    """
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True, index=True)

    quantity_delta = Column(Numeric(10, 3), nullable=False)  # відʼємне = списання
    cost_at_moment = Column(Numeric(10, 2), nullable=True)   # вартість на момент руху
    reason = Column(String, nullable=False)  # service_usage / manual / restock / revert
    created_at = Column(DateTime, default=utc_now)


class Task(Base):
    """
    Справи закладу на день - «замовити шампунь», «передзвонити постачальнику».

    Раніше цей список жив лише в localStorage браузера: зникав при чистці
    кешу і не бачився з іншого пристрою. Для списку, у який записують
    робочі справи, це неприйнятно - на нього мають покладатися.

    Привʼязка до дати, а не «просто список»: справи в салоні майже завжди
    прив'язані до дня, а безстроковий список швидко перетворюється на
    звалище.
    """
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    task_date = Column(Date, nullable=False, index=True)

    text = Column(String, nullable=False)
    completed = Column(Boolean, default=False, nullable=False)

    # Хто створив - у салоні кілька людей мають доступ до кабінету,
    # і корисно бачити, чия це справа.
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utc_now)
    completed_at = Column(DateTime, nullable=True)
