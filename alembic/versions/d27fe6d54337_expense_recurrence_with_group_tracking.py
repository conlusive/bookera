"""expense recurrence with group tracking

Revision ID: d27fe6d54337
Revises: 06f904351d3b
Create Date: 2026-08-31 10:35:12.442310

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd27fe6d54337'
down_revision: Union[str, Sequence[str], None] = '06f904351d3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('expenses', sa.Column('recurrence', sa.String(), server_default='none', nullable=False))
    op.add_column('expenses', sa.Column('recurrence_group_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_expenses_recurrence_group_id'), 'expenses', ['recurrence_group_id'], unique=False)
    op.drop_column('expenses', 'is_recurring')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('expenses', sa.Column('is_recurring', sa.Boolean(), server_default='false', nullable=True))
    op.drop_index(op.f('ix_expenses_recurrence_group_id'), table_name='expenses')
    op.drop_column('expenses', 'recurrence_group_id')
    op.drop_column('expenses', 'recurrence')
