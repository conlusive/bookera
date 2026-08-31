"""nullable service_id for time-blocking, reschedule support

Revision ID: 42f38bf8dd31
Revises: d27fe6d54337
Create Date: 2026-08-31 10:48:03.221904

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '42f38bf8dd31'
down_revision: Union[str, Sequence[str], None] = 'd27fe6d54337'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # nullable=True: "блокування часу" (обід, особиста справа) не прив'язане
    # до жодної послуги.
    op.alter_column('appointments', 'service_id', existing_type=sa.INTEGER(), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('appointments', 'service_id', existing_type=sa.INTEGER(), nullable=False)
