"""staff schedule per business

Revision ID: c0d1e2f3a4b5
Revises: b9c0d1e2f3a4
Create Date: 2026-09-26 10:00:00.000000

Графік майстра переїжджає з людини (users.shifts) на членство в закладі
(staff_memberships.shifts). Щоб нічого не змінилось для вже налаштованих
майстрів, їхній графік копіюється в КОЖНЕ їхнє членство - далі салони
змінюють кожен свій.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c0d1e2f3a4b5'
down_revision: Union[str, Sequence[str], None] = 'b9c0d1e2f3a4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('staff_memberships', sa.Column('shifts', sa.JSON(), nullable=True))
    op.execute("""
        UPDATE staff_memberships m SET shifts = u.shifts
        FROM users u WHERE u.id = m.user_id AND u.shifts IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_column('staff_memberships', 'shifts')
