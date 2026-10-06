"""Згода клієнта на розсилки (clients.marketing_consent)

NULL - клієнта про це не питали (усі, хто був до цієї зміни): лишається в розсилках, у кожному листі є відписка.
TRUE - погодився. FALSE - явно не погодився: у розсилки не потрапляє.

Revision ID: 47df68fdeef9
Revises: bcb57024ab79
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '47df68fdeef9'
down_revision: Union[str, Sequence[str], None] = 'bcb57024ab79'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('clients', sa.Column('marketing_consent', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('clients', 'marketing_consent')
