"""
Одна людина - одна картка клієнта в закладі.

Раніше «той самий клієнт» визначався по-різному: онлайн-запис порівнював номер рядок у рядок (+380 50 111 22 33 і
0501112233 давали ДВІ картки), ручний запис - так само, імпорт і ручне додавання - за останніми 9 цифрами, а
редагування картки не перевіряло нічого. Тепер усе йде через це місце, а на рівні бази діють унікальні індекси
(міграція 5e1d2c3b4a60): навіть дві одночасні операції не створять дубль - друга знайде вже створену картку.

Ключ клієнта: останні 9 цифр номера (як у client_stats.phone_tail) і пошта без регістру й пробілів.
"""
from typing import Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Client
from app.services.client_stats import phone_tail


def email_key(email: Optional[str]) -> Optional[str]:
    e = (email or "").strip().lower()
    return e or None


_DIGITS = r"\D"


def _phone_expr():
    """Той самий вираз, що в унікальному індексі: останні 9 цифр номера."""
    return func.right(func.regexp_replace(Client.phone, _DIGITS, "", "g"), 9)


async def find_client(db: AsyncSession, business_id: int, phone: Optional[str], email: Optional[str],
                      exclude_id: Optional[int] = None) -> Optional[Client]:
    """Картка цього закладу з тим самим номером чи поштою. Номер важливіший за пошту."""
    tail = phone_tail(phone)
    e = email_key(email)
    for cond in ([_phone_expr() == tail] if tail else []) + ([func.lower(func.btrim(Client.email)) == e] if e else []):
        stmt = select(Client).where(Client.business_id == business_id, cond).order_by(Client.id)
        if exclude_id is not None:
            stmt = stmt.where(Client.id != exclude_id)
        found = (await db.execute(stmt)).scalars().first()
        if found:
            return found
    return None


async def get_or_create_client(db: AsyncSession, business_id: int, *, name: Optional[str], phone: Optional[str],
                               email: Optional[str] = None, **fields) -> Tuple[Client, bool]:
    """
    Знайти картку або створити нову. Повертає (картка, створено_щойно).
    Знайдену картку не перетираємо, лише дописуємо те, чого в ній не було (пошту, номер).
    Якщо поруч одночасно створили таку саму - вставка впаде на унікальному індексі, і ми візьмемо ту, що вже є.
    """
    existing = await find_client(db, business_id, phone, email)
    if existing:
        _fill_blanks(existing, phone, email)
        return existing, False
    client = Client(business_id=business_id, name=name or phone or email or "Клієнт", phone=phone, email=(email or "").strip() or None, **fields)
    try:
        async with db.begin_nested():
            db.add(client)
            await db.flush()
    except IntegrityError:
        existing = await find_client(db, business_id, phone, email)
        if existing:
            _fill_blanks(existing, phone, email)
            return existing, False
        raise
    return client, True


def _fill_blanks(client: Client, phone: Optional[str], email: Optional[str]) -> None:
    if phone and not client.phone:
        client.phone = phone
    if email and not (client.email or "").strip():
        client.email = email.strip()
