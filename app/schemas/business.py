from datetime import time as dt_time
from typing import List, Optional
from app.core.categories import normalize_category
from pydantic import field_validator, BaseModel, ConfigDict
from decimal import Decimal


class ServiceOut(BaseModel):
    id: int
    business_id: int
    name: str
    description: Optional[str] = None
    price: Decimal
    duration_minutes: int
    is_group: bool = False
    max_participants: int = 1
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class BusinessHoursItem(BaseModel):
    weekday: int  # 0=понеділок ... 6=неділя
    is_open: bool = True
    open_time: dt_time = dt_time(9, 0)
    close_time: dt_time = dt_time(20, 0)

    model_config = ConfigDict(from_attributes=True)


class BusinessBase(BaseModel):
    name: str
    category: Optional[str] = "other"
    business_type: Optional[str] = None
    workspace_type: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    # Без підстановки «Львів»: реєстрація не надсилала місто окремо, і
    # кожен новий заклад, звідки б він не був, ставав львівським.
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    cover_photo: Optional[str] = None
    logo: Optional[str] = None
    tags: Optional[List[str]] = []

    # Будь-яке значення - стара назва, код зі старого списку - стає
    # кодом із єдиного списку (app/core/categories.py).
    @field_validator("category", mode="before")
    @classmethod
    def _normalize_category(cls, v):
        return normalize_category(v) if v is not None else v

class BusinessCreate(BusinessBase):
    # slug генерується на бекенді (унікальність гарантована там же)
    hours: Optional[List[BusinessHoursItem]] = None
    # Точка з мапи на кроці адреси. Є - не геокодуємо: власник сам поставив
    # мітку туди, де заклад справді є.
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    show_phone_publicly: Optional[bool] = True

    @field_validator("email", mode="before")
    @classmethod
    def _email(cls, v):
        """Пошта ЗАКЛАДУ: сюди приходять записи й сповіщення - має бути справжньою."""
        if v is None or str(v).strip() == "":
            return None
        from email_validator import EmailNotValidError, validate_email
        try:
            return validate_email(str(v).strip(), check_deliverability=False).normalized.lower()
        except EmailNotValidError:
            raise ValueError("Невірна адреса пошти закладу")

    @field_validator("phone", mode="before")
    @classmethod
    def _phone(cls, v):
        """Робочий телефон закладу у форматі +380XXXXXXXXX."""
        if v is None or str(v).strip() == "":
            return None
        digits = "".join(ch for ch in str(v) if ch.isdigit())
        if len(digits) == 9:
            digits = "380" + digits
        elif len(digits) == 10 and digits.startswith("0"):
            digits = "38" + digits
        if not (len(digits) == 12 and digits.startswith("380")):
            raise ValueError("Телефон закладу - український номер: +380 XX XXX XX XX")
        return "+" + digits

    @field_validator("latitude")
    @classmethod
    def _lat(cls, v):
        if v is not None and not -90 <= v <= 90:
            raise ValueError("Невірна широта")
        return v

    @field_validator("longitude")
    @classmethod
    def _lng(cls, v):
        if v is not None and not -180 <= v <= 180:
            raise ValueError("Невірна довгота")
        return v


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    # Тип бізнесу й спосіб роботи. Їх не було в схемі оновлення, тому
    # Pydantic мовчки відкидав ці поля: інтерфейс показував «збережено»,
    # а в базі нічого не змінювалось.
    business_type: Optional[str] = None
    workspace_type: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    cover_photo: Optional[str] = None
    logo: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None
    accent_color: Optional[str] = None
    layout_config: Optional[dict] = None
    workplace_photos: Optional[List[str]] = None
    booking_settings: Optional[dict] = None
    show_phone_publicly: Optional[bool] = True
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Відстань від точки пошуку. Заповнюється лише коли клієнт передав
    # свої координати - інакше показувати нічого.
    distance_km: Optional[float] = None
    # Чи це відстань по дорогах. False - по прямій, приблизна.
    distance_is_road: Optional[bool] = None
    security_settings: Optional[dict] = None
    notification_settings: Optional[dict] = None
    payments_settings: Optional[dict] = None

    # Будь-яке значення - стара назва, код зі старого списку - стає
    # кодом із єдиного списку (app/core/categories.py).
    @field_validator("category", mode="before")
    @classmethod
    def _normalize_category(cls, v):
        return normalize_category(v) if v is not None else v

class WorkingDayOut(BaseModel):
    """Робочий день закладу для публічної сторінки.

    Раніше сторінка салону визначала вихідні за полем days_off -
    застарілим. CRM зберігає графік у таблицю business_hours, тому
    заклад міняв суботу в кабінеті, а сторінка про це не знала.
    """
    weekday: int
    is_open: bool
    open_time: Optional[str] = None
    close_time: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BusinessOut(BusinessBase):
    id: int
    slug: str
    # Графік роботи - те саме джерело, що й у CRM.
    working_hours: List[WorkingDayOut] = []
    # Публічні правила запису: клієнт має бачити політику скасування
    # ДО того, як записався, а не дізнаватись про неї постфактум.
    # Віддаємо лише те, що стосується клієнта - решта налаштувань
    # (безпека, платежі) не його справа.
    booking_settings: Optional[dict] = None
    show_phone_publicly: Optional[bool] = True
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Відстань від точки пошуку. Заповнюється лише коли клієнт передав
    # свої координати - інакше показувати нічого.
    distance_km: Optional[float] = None
    # Чи це відстань по дорогах. False - по прямій, приблизна.
    distance_is_road: Optional[bool] = None
    # Без цього поля інтерфейс не міг визначити власника: перевірка
    # userProfile.id === business.owner_id завжди давала false, і кнопки
    # для адміністратора зникали.
    owner_id: Optional[str] = None
    rating: Optional[Decimal] = Decimal("5.0")
    reviews_count: Optional[int] = 0
    is_active: bool = True
    # Просування «Радар». is_radar_active - чи чинний пакет (на картці
    # з'являється позначка «Реклама»). rank_score - якість + Радар за
    # правилами app/services/ranking.py; вітрина додає до нього відстань
    # і вільні вікна. radar_bonus_km - на скільки кілометрів заклад
    # «ближчий» у сортуванні за відстанню (0 без Радара).
    is_radar_active: bool = False
    rank_score: Optional[float] = None
    radar_bonus_km: float = 0
    services: Optional[List[ServiceOut]] = []
    accent_color: Optional[str] = None
    layout_config: Optional[dict] = None
    workplace_photos: Optional[List[str]] = []
    booking_settings: Optional[dict] = None
    show_phone_publicly: Optional[bool] = True
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Відстань від точки пошуку. Заповнюється лише коли клієнт передав
    # свої координати - інакше показувати нічого.
    distance_km: Optional[float] = None
    # Чи це відстань по дорогах. False - по прямій, приблизна.
    distance_is_road: Optional[bool] = None
    security_settings: Optional[dict] = None
    notification_settings: Optional[dict] = None
    payments_settings: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)
