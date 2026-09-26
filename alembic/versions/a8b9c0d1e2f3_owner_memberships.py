"""owners become members of their own businesses

Revision ID: a8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-09-25 12:00:00.000000

Створення закладу не додавало власника в staff_memberships, а перемикач
закладів у кабінеті будується саме з членства. Тож другий заклад на
тому самому акаунті не зʼявлявся в перемикачі. Тут відновлюємо членство
для кожного власника й для кожного «поточного закладу» користувача.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'a8b9c0d1e2f3'
down_revision: Union[str, Sequence[str], None] = 'f7a8b9c0d1e2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Власники
    op.execute("""
        INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at)
        SELECT b.owner_id, b.id, 'business_owner', true, now()
        FROM businesses b
        WHERE b.owner_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM staff_memberships m WHERE m.user_id = b.owner_id AND m.business_id = b.id)
    """)
    # «Поточний заклад» без членства - з роллю користувача
    op.execute("""
        INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at)
        SELECT u.id, u.business_id, COALESCE(u.role, 'master'), true, now()
        FROM users u
        WHERE u.business_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM businesses b WHERE b.id = u.business_id)
          AND NOT EXISTS (SELECT 1 FROM staff_memberships m WHERE m.user_id = u.id AND m.business_id = u.business_id)
    """)


def downgrade() -> None:
    # Записи членства - справжні дані; прибирати їх назад не безпечно.
    pass
