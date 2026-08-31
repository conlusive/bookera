"""add manage_token for client self-service

Revision ID: 0ea55ef9a31b
Revises: 8d11be8c8e9d
Create Date: 2026-08-31 09:36:47.181815

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0ea55ef9a31b'
down_revision: Union[str, Sequence[str], None] = '8d11be8c8e9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ПРИМІТКА: тут вручну прибрані drop_index/create_index на 4 старих
    # індексах (ix_appointments_business_start і т.д.) - autogenerate
    # хотів їх видалити, бо вони додані напряму SQL у першій міграції,
    # а не оголошені в ORM-моделях. Вони й далі потрібні, тому лишаємо.
    op.add_column('appointments', sa.Column('manage_token', sa.String(), nullable=True))
    op.create_index(op.f('ix_appointments_manage_token'), 'appointments', ['manage_token'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_appointments_manage_token'), table_name='appointments')
    op.drop_column('appointments', 'manage_token')
