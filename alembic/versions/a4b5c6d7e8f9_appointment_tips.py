"""appointment tips

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-09-28 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a4b5c6d7e8f9'
down_revision: Union[str, Sequence[str], None] = 'f3a4b5c6d7e8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('appointments', sa.Column('tip_amount', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('appointments', 'tip_amount')
