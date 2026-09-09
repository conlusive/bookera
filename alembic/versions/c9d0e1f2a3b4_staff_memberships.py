"""staff memberships - робота в кількох закладах

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-09-08 22:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, Sequence[str], None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'staff_memberships',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(), server_default='master', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('joined_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('left_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'business_id', name='uq_staff_membership'),
    )
    op.create_index(op.f('ix_staff_memberships_id'), 'staff_memberships', ['id'])
    op.create_index(op.f('ix_staff_memberships_user_id'), 'staff_memberships', ['user_id'])
    op.create_index(op.f('ix_staff_memberships_business_id'), 'staff_memberships', ['business_id'])

    # Переносимо наявні звʼязки.
    #
    # Без цього кроку всі, хто вже працює в закладі, після оновлення
    # опинились би без жодного членства - і перемикач показав би
    # порожній список у людей, які щойно нормально працювали.
    op.execute("""
        INSERT INTO staff_memberships (user_id, business_id, role, is_active, joined_at)
        SELECT id, business_id, role, true, COALESCE(created_at, now())
        FROM users
        WHERE business_id IS NOT NULL
        ON CONFLICT (user_id, business_id) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table('staff_memberships')
