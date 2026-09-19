"""business coordinates

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-09-22 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('businesses', sa.Column('latitude', sa.Numeric(10, 7), nullable=True))
    op.add_column('businesses', sa.Column('longitude', sa.Numeric(10, 7), nullable=True))

    # Індекс на парі координат: пошук «поблизу» фільтрує спершу
    # прямокутником навколо точки, і без індексу це повний перебір
    # таблиці на кожен запит.
    op.execute("CREATE INDEX IF NOT EXISTS ix_businesses_coords ON businesses (latitude, longitude)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_businesses_coords")
    op.drop_column('businesses', 'longitude')
    op.drop_column('businesses', 'latitude')
