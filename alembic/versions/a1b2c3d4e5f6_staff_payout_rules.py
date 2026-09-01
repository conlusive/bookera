"""staff payout rules

Revision ID: a1b2c3d4e5f6
Revises: 67ef2a0c0417
Create Date: 2026-09-01 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '67ef2a0c0417'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('payout_period', sa.String(), nullable=True))
    op.add_column('users', sa.Column('payout_day', sa.String(), nullable=True))
    op.add_column('users', sa.Column('tips_full', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('users', sa.Column('deduct_materials', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('users', sa.Column('auto_reset_balance', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'auto_reset_balance')
    op.drop_column('users', 'deduct_materials')
    op.drop_column('users', 'tips_full')
    op.drop_column('users', 'payout_day')
    op.drop_column('users', 'payout_period')
