"""Коли клієнта запитали про розсилки (clients.marketing_asked_at)

Питання про розсилку виникає після підтвердженого запису (а не галочкою в формі) і лише раз: поки
marketing_asked_at порожнє й згоди немає, після запису показуємо вікно. Відповідь (так/ні) фіксується тут.

Revision ID: 3a7c9e1b5d44
Revises: 9b3e7a1c5d20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '3a7c9e1b5d44'
down_revision: Union[str, Sequence[str], None] = '9b3e7a1c5d20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('clients', sa.Column('marketing_asked_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('clients', 'marketing_asked_at')
