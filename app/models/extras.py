from datetime import datetime, date as dt_date

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Numeric, Text, SmallInteger, Boolean
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
    is_recurring = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

    business = relationship("Business", back_populates="expenses")
