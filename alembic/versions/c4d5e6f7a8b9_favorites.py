"""favorites

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-09-18 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Таблиця могла лишитись від старої схеми - фронтенд писав у неї
    # напряму. Створюємо лише якщо її немає, щоб не втратити наявні дані.
    op.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR NOT NULL REFERENCES users(id),
            business_id INTEGER NOT NULL REFERENCES businesses(id),
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT uq_favorite UNIQUE (user_id, business_id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_favorites_user_id ON favorites (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_favorites_business_id ON favorites (business_id)")


def downgrade() -> None:
    op.drop_table('favorites')
