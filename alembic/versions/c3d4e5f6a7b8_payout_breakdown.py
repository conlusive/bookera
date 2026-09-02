"""payout breakdown

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-02 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('staff_payouts', sa.Column('commission_part', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('staff_payouts', sa.Column('fixed_part', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('staff_payouts', sa.Column('tax_amount', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('staff_payouts', sa.Column('appointments_count', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('staff_payouts', 'appointments_count')
    op.drop_column('staff_payouts', 'tax_amount')
    op.drop_column('staff_payouts', 'fixed_part')
    op.drop_column('staff_payouts', 'commission_part')
