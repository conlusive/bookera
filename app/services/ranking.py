"""
Правила видачі закладів і платного просування «Радар» - В ОДНОМУ МІСЦІ.

Вітрина, кабінет власника й тести беруть числа звідси: фронтенд не має
власних копій ваг (див. /businesses/ranking-rules). Тож «що дає Радар»,
«скільки він коштує» й «як рахується позиція» не можуть розійтись.

Позиція в «Рекомендованих» - 100 балів:

    якість           до 50   рейтинг із поправкою на кількість відгуків
    поруч            до 22   чим ближче до людини (до 10 км), тим більше
    вільні вікна     до 18   є вільний час сьогодні
    Радар            до 10   лише поки пакет активний; залежить від якості (див. нижче)

Радар - ПІДСИЛЕННЯ, а не заміна якості (як «Топ» на OLX чи просування в Booksy):
він піднімає заклад над рівними собі, але не над помітно кращими. Бонус =
RADAR_BONUS x (0.4 + 0.6 x частка якості): слабкий заклад отримує менше за сильний,
тож платний пакет не перекриває різницю в 15-20 балів якості.

Якість і Радар рахує сервер (`rank_score`), відстань і вільні вікна
відомі лише браузеру людини (геолокація, слоти) - він додає їх до
`rank_score` за вагами з ranking_rules().

Три сортування вітрини (правила однакові для всіх, див. lib/storefront-sort.ts):

    Найближчі     від найближчого; заклад із Радаром рахується ближчим на RADAR_BONUS_KM
    Дешевші       спершу заклади в радіусі NEARBY_RADIUS_KM (за ціною), потім решта (теж за ціною)
    Рекомендовані спершу в радіусі NEARBY_RADIUS_KM (за позицією), потім решта (теж за позицією)

    Перемикач «По всьому місту» знімає розподіл на «поруч» і «далі»: чиста ціна чи позиція.

У виборі «Найближчі» Радар працює інакше: заклад рахується ближчим на
RADAR_BONUS_KM. Так сортування за відстанню лишається чесним (далекий
заклад не піднімається над усіма), а промо-заклад помітно вище.
"""
from datetime import timedelta
from decimal import Decimal
from typing import Iterable, Optional, Set

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time_utils import utc_now
from app.models import Business, RadarBoost

# --- вага компонентів (разом 100) ---
QUALITY_MAX = 50.0
PROXIMITY_MAX = 22.0
FREE_SLOTS_BONUS = 18.0
RADAR_BONUS = 10.0          # максимум; реальний бонус залежить від якості (radar_points)
RADAR_QUALITY_FLOOR = 0.4   # частка бонусу, яку отримує навіть заклад із нульовою якістю

# --- якість ---
# Заклад без відгуків не стартує з «ідеальної» п'ятірки: його рейтинг
# «підтягується» до PRIOR_RATING, наче в нього вже є PRIOR_WEIGHT відгуків.
PRIOR_RATING = 4.3
PRIOR_WEIGHT = 5
RATING_FLOOR = 3.5   # рейтинг на цьому рівні й нижче - 0 балів якості
RATING_TOP = 5.0

# --- відстань ---
# «Поруч» для сортувань «Дешевші» і «Рекомендовані»: заклади в цьому радіусі
# йдуть першими (кожен блок - за своїм правилом), решта - слідом.
NEARBY_RADIUS_KM = 15.0
PROXIMITY_RADIUS_KM = 10.0
RADAR_BONUS_KM = 2.0   # у «Найближчих» заклад із Радаром - наче на стільки ближче

# --- пакети Радара ---
# Ціни - у гривнях і в балах (бал заробляється за нового клієнта екосистеми).
# Довший пакет дешевший за день: це стимул не продовжувати по тижню.
# 1 і 3 дні - для разової акції, найдорожче за день. 90 днів - зобов'язання: оплачується наперед, без скасування
# й повернення, зате комісія за нового клієнта з вітрини на ці дні знижена (COMMITMENT_COMMISSION_RATE).
COMMITMENT_DAYS = 90
COMMITMENT_COMMISSION_RATE = Decimal("7.00")   # замість стандартних 10%
RADAR_PACKAGES = (
    {"days": 1, "price_uah": 99, "price_points": 40},
    {"days": 3, "price_uah": 199, "price_points": 80},
    {"days": 7, "price_uah": 299, "price_points": 100},
    {"days": 14, "price_uah": 529, "price_points": 180},
    {"days": 30, "price_uah": 999, "price_points": 330},
    {"days": COMMITMENT_DAYS, "price_uah": 2490, "price_points": 900, "commitment": True},
)


def package_for_days(days: int) -> Optional[dict]:
    for p in RADAR_PACKAGES:
        if p["days"] == days:
            return p
    return None


def packages_view() -> list:
    """Пакети з ціною за день і знижкою відносно найкоротшого - для інтерфейсу."""
    base = RADAR_PACKAGES[0]["price_uah"] / RADAR_PACKAGES[0]["days"]
    out = []
    for p in RADAR_PACKAGES:
        per_day = p["price_uah"] / p["days"]
        out.append({
            **p,
            "commitment": bool(p.get("commitment")),
            "commission_rate": float(COMMITMENT_COMMISSION_RATE) if p.get("commitment") else None,
            "per_day_uah": round(per_day, 1),
            "discount_percent": max(0, round((1 - per_day / base) * 100)),
        })
    return out


def quality_score(rating, reviews_count) -> float:
    """0..QUALITY_MAX. Рейтинг із поправкою на кількість відгуків."""
    r = float(rating) if rating is not None else PRIOR_RATING
    n = max(int(reviews_count or 0), 0)
    adjusted = (r * n + PRIOR_RATING * PRIOR_WEIGHT) / (n + PRIOR_WEIGHT)
    share = (adjusted - RATING_FLOOR) / (RATING_TOP - RATING_FLOOR)
    return round(QUALITY_MAX * min(max(share, 0.0), 1.0), 2)


def radar_points(rating, reviews_count) -> float:
    """Скільки балів дає Радар цьому закладу: від 40% до 100% максимуму, залежно від якості."""
    share = quality_score(rating, reviews_count) / QUALITY_MAX
    return round(RADAR_BONUS * (RADAR_QUALITY_FLOOR + (1 - RADAR_QUALITY_FLOOR) * share), 2)


def rank_score(rating, reviews_count, radar_active: bool) -> float:
    """Частина позиції, яку знає сервер: якість + Радар (з поправкою на якість)."""
    bonus = radar_points(rating, reviews_count) if radar_active else 0.0
    return round(quality_score(rating, reviews_count) + bonus, 2)


def ranking_rules() -> dict:
    """Усе, що потрібно вітрині, щоб дорахувати позицію в браузері."""
    return {
        "weights": {
            "quality_max": QUALITY_MAX,
            "proximity_max": PROXIMITY_MAX,
            "free_slots": FREE_SLOTS_BONUS,
            "radar": RADAR_BONUS,
        },
        "proximity_radius_km": PROXIMITY_RADIUS_KM,
        "nearby_radius_km": NEARBY_RADIUS_KM,
        "radar_bonus_km": RADAR_BONUS_KM,
    }


def _active_clauses():
    return (RadarBoost.status == "active", RadarBoost.expires_at > utc_now())


async def commitment_active(db: AsyncSession, business_id: int) -> bool:
    """Чи діє зараз «довгий» пакет-зобов'язання (90 днів): на цей час комісія за нового клієнта знижена."""
    now = utc_now()
    rows = (await db.execute(
        select(RadarBoost.started_at, RadarBoost.expires_at).where(
            RadarBoost.business_id == business_id, RadarBoost.status == "active",
            RadarBoost.started_at <= now, RadarBoost.expires_at > now,
        )
    )).all()
    return any((e - s_).days >= COMMITMENT_DAYS - 5 for s_, e in rows)


async def active_radar_ids(db: AsyncSession, business_ids: Optional[Iterable[int]] = None) -> Set[int]:
    """Заклади, у яких зараз чинний пакет Радара."""
    stmt = select(RadarBoost.business_id).where(*_active_clauses())
    if business_ids is not None:
        ids = list(business_ids)
        if not ids:
            return set()
        stmt = stmt.where(RadarBoost.business_id.in_(ids))
    return set((await db.execute(stmt)).scalars().all())


async def grant_radar(
    db: AsyncSession, business_id: int, days: int, paid_with: str,
    points_spent: Optional[int] = None, payment_id: Optional[int] = None,
):
    """
    Нараховує дні Радара. Є чинний пакет - нові дні додаються до його кінця,
    а не з'їдають залишок: хто купив заздалегідь, нічого не втрачає.
    Повертає запис пакета (новий RadarBoost, ще не закомічений).
    """
    last = (await db.execute(
        select(RadarBoost.expires_at).where(RadarBoost.business_id == business_id, *_active_clauses())
        .order_by(RadarBoost.expires_at.desc()).limit(1)
    )).scalars().first()
    start_from = last if last else utc_now()
    boost = RadarBoost(
        business_id=business_id,
        started_at=start_from,
        expires_at=start_from + timedelta(days=days),
        paid_with=paid_with,
        points_spent=points_spent,
        payment_id=payment_id,
        status="active",
    )
    db.add(boost)
    return boost


async def position_in_market(db: AsyncSession, business) -> dict:
    """
    Де заклад у «якості + Радар» серед закладів його міста й категорії -
    з Радаром і без нього. Це та частина позиції, яку знає сервер;
    відстань і вільні вікна в кожної людини свої.
    """
    stmt = select(Business.id, Business.rating, Business.reviews_count).where(
        Business.is_active == True,  # noqa: E712
        Business.subscription_plan.in_(["trial", "active"]),
        func.lower(Business.city) == (business.city or "").lower(),
        Business.category == business.category,
    )
    rows = (await db.execute(stmt)).all()
    if not any(r.id == business.id for r in rows):
        rows = list(rows) + [type("R", (), {"id": business.id, "rating": business.rating, "reviews_count": business.reviews_count})()]
    boosted = await active_radar_ids(db, [r.id for r in rows])

    def position(me_boosted: bool) -> int:
        scored = []
        for r in rows:
            b = me_boosted if r.id == business.id else (r.id in boosted)
            scored.append((-rank_score(r.rating, r.reviews_count, b), r.id))
        scored.sort()
        return [i for _, i in scored].index(business.id) + 1

    return {
        "total": len(rows),
        "position": position(business.id in boosted),
        "position_without_radar": position(False),
        "position_with_radar": position(True),
    }
