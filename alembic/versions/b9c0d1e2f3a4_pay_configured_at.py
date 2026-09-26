"""staff pay configured moment

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3
Create Date: 2026-09-25 14:00:00.000000

Зарплата існує лише після того, як власник налаштував оплату майстра.
Тим, у кого період виплат уже був обраний, ставимо «налаштовано зараз»:
так вони не отримають нагадування одразу - наступне через повний період.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b9c0d1e2f3a4'
down_revision: Union[str, Sequence[str], None] = 'a8b9c0d1e2f3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('pay_configured_at', sa.DateTime(), nullable=True))
    op.execute("""
        UPDATE users u SET pay_configured_at = now()
        WHERE u.payout_period IS NOT NULL AND u.payout_period <> 'none'
          AND (COALESCE(u.commission_rate, 0) > 0 OR COALESCE(u.fixed_salary, 0) > 0)
          AND NOT EXISTS (SELECT 1 FROM businesses b WHERE b.owner_id = u.id)
    """)


def downgrade() -> None:
    op.drop_column('users', 'pay_configured_at')
