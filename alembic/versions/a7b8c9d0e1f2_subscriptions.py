"""subscriptions and platform admin

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-09-08 02:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('businesses', sa.Column('subscription_plan', sa.String(), server_default='free', nullable=False))
    op.add_column('businesses', sa.Column('subscription_until', sa.DateTime(), nullable=True))
    op.add_column('businesses', sa.Column('subscription_note', sa.String(), nullable=True))
    op.add_column('users', sa.Column('is_platform_admin', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'is_platform_admin')
    op.drop_column('businesses', 'subscription_note')
    op.drop_column('businesses', 'subscription_until')
    op.drop_column('businesses', 'subscription_plan')
