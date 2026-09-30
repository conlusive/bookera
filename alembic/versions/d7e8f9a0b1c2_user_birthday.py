"""user birthday

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
Create Date: 2026-09-30 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd7e8f9a0b1c2'
down_revision: Union[str, Sequence[str], None] = 'c6d7e8f9a0b1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('birthday', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'birthday')
