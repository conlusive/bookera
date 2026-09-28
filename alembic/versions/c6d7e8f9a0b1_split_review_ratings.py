"""separate master and salon ratings

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-09-29 10:00:00.000000

Старі відгуки мали одну оцінку - вона стає і оцінкою майстра, і
оцінкою закладу: інакше історія зникла б з обох рейтингів.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c6d7e8f9a0b1'
down_revision: Union[str, Sequence[str], None] = 'b5c6d7e8f9a0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('reviews', sa.Column('master_rating', sa.Integer(), nullable=True))
    op.add_column('reviews', sa.Column('salon_rating', sa.Integer(), nullable=True))
    op.execute("UPDATE reviews SET master_rating = rating, salon_rating = rating WHERE rating IS NOT NULL")


def downgrade() -> None:
    op.drop_column('reviews', 'salon_rating')
    op.drop_column('reviews', 'master_rating')
