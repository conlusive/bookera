import enum
from datetime import datetime

from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Boolean, Numeric, JSON
from sqlalchemy.orm import relationship

from app.core.time_utils import utc_now
from app.models.base import Base


class RoleEnum(str, enum.Enum):
    CLIENT = "client"
    VENDOR = "vendor"
    MASTER = "master"
    ADMIN = "admin"
    BUSINESS_OWNER = "business_owner"
    STAFF = "staff"


class User(Base):
    """
    Один запис = одна людина. id збігається з Supabase auth.users.id (uuid як текст).
    Раніше в проєкті існувала ОКРЕМА таблиця 'staff' у Supabase, яку писав
    напряму фронтенд - це та сама сутність, продубльована вдруге. Тепер вона одна.
    """
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    role = Column(String, default="client", nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)

    # Раніше жили лише у фронтенд-компонентах (TeamTab), без відповідника в БД.
    specialization = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    commission_rate = Column(Numeric(5, 2), nullable=True)  # % комісії майстра

    # Оплата праці: у салонах поширені три моделі - лише відсоток, лише
    # оклад, або комбінація. Раніше цих полів не було на бекенді, і я
    # прибрав їх з інтерфейсу - неправильно, бо для частини закладів
    # фіксована ставка це основний спосіб оплати.
    fixed_salary = Column(Numeric(10, 2), nullable=True)
    tax_rate = Column(Numeric(5, 2), nullable=True)  # % утримання (ФОП/ЄСВ тощо)
    payment_method = Column(String, nullable=True)  # cash / card

    # Особистий графік майстра (може відрізнятись від графіка закладу) та
    # перелік послуг, які саме він виконує. JSON, бо читаються й
    # перезаписуються цілком, ніколи не фільтруються по вмісту.
    shifts = Column(JSON, nullable=True)
    assigned_services = Column(JSON, default=list)
    provides_services = Column(Boolean, default=True, nullable=False)

    # Правила виплат конкретному майстру (періодичність, день, що входить
    # у розрахунок). Раніше ці перемикачі в CRM нічого не зберігали -
    # виглядали робочими, але значення губились при перезавантаженні.
    payout_period = Column(String, nullable=True)  # weekly / monthly
    payout_day = Column(String, nullable=True)     # 'monday' або число дня місяця
    tips_full = Column(Boolean, default=True, nullable=False)       # майстер забирає 100% чайових
    deduct_materials = Column(Boolean, default=False, nullable=False)  # віднімати вартість матеріалів
    auto_reset_balance = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=utc_now, nullable=False)

    business = relationship("Business", back_populates="staff", foreign_keys=[business_id])
    owned_businesses = relationship("Business", back_populates="owner", foreign_keys="Business.owner_id")
    appointments_as_master = relationship("Appointment", back_populates="master", foreign_keys="Appointment.master_id")


class StaffInvite(Base):
    """Заміняє хардкоджений виклик на 127.0.0.1:8000/businesses/{id}/invites."""
    __tablename__ = "staff_invites"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    email = Column(String, nullable=False, index=True)
    role = Column(String, default="master", nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending, accepted, expired, revoked
    invited_by = Column(String, ForeignKey("users.id"), nullable=True)
    accepted_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    expires_at = Column(DateTime, nullable=False)

    business = relationship("Business", back_populates="invites")
