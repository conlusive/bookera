"""staff compensation and personal schedule fields

Revision ID: 67ef2a0c0417
Revises: 9ccfdefb579a
Create Date: 2026-09-01 00:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '67ef2a0c0417'
down_revision: Union[str, Sequence[str], None] = '9ccfdefb579a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('fixed_salary', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('users', sa.Column('tax_rate', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('users', sa.Column('payment_method', sa.String(), nullable=True))
    op.add_column('users', sa.Column('shifts', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('assigned_services', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('provides_services', sa.Boolean(), server_default='true', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'provides_services')
    op.drop_column('users', 'assigned_services')
    op.drop_column('users', 'shifts')
    op.drop_column('users', 'payment_method')
    op.drop_column('users', 'tax_rate')
    op.drop_column('users', 'fixed_salary')
