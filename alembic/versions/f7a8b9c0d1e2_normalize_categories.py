"""normalize business categories to the single list

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-09-25 10:00:00.000000

Раніше на сайті було пʼять різних списків категорій, і в базі лежали
вперемішку коди (`wellness`, `home_services`), українські назви
(«Барбер», «Салон краси») й старі коди (`beauty`, `spa`). Тут усе
перетворюється на коди з єдиного списку app/core/categories.py.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, Sequence[str], None] = 'e6f7a8b9c0d1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.core.categories import normalize_category
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT DISTINCT category FROM businesses")).fetchall()
    for (value,) in rows:
        slug = normalize_category(value)
        if value != slug:
            conn.execute(
                sa.text("UPDATE businesses SET category = :slug WHERE category IS NOT DISTINCT FROM :old"),
                {"slug": slug, "old": value},
            )
    op.alter_column('businesses', 'category', server_default='other')


def downgrade() -> None:
    # Старі значення не відновлюються: це були різні написання того самого.
    op.alter_column('businesses', 'category', server_default=None)
