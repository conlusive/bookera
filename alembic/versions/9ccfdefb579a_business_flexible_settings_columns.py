"""business flexible settings columns

Revision ID: 9ccfdefb579a
Revises: 42f38bf8dd31
Create Date: 2026-08-31 15:28:16.410048

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9ccfdefb579a'
down_revision: Union[str, Sequence[str], None] = '42f38bf8dd31'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('businesses', sa.Column('accent_color', sa.String(), nullable=True))
    op.add_column('businesses', sa.Column('layout_config', sa.JSON(), nullable=True))
    op.add_column('businesses', sa.Column('workplace_photos', sa.JSON(), nullable=True))
    op.add_column('businesses', sa.Column('booking_settings', sa.JSON(), nullable=True))
    op.add_column('businesses', sa.Column('security_settings', sa.JSON(), nullable=True))
    op.add_column('businesses', sa.Column('notification_settings', sa.JSON(), nullable=True))
    op.add_column('businesses', sa.Column('payments_settings', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('businesses', 'payments_settings')
    op.drop_column('businesses', 'notification_settings')
    op.drop_column('businesses', 'security_settings')
    op.drop_column('businesses', 'booking_settings')
    op.drop_column('businesses', 'workplace_photos')
    op.drop_column('businesses', 'layout_config')
    op.drop_column('businesses', 'accent_color')
