"""Акції закладу: знижка на послуги в певні дні й години.

Revision ID: 6a2b3c4d5e71
Revises: 5e1d2c3b4a60
Create Date: 2026-10-07
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '6a2b3c4d5e71'
down_revision: Union[str, Sequence[str], None] = '5e1d2c3b4a60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'promotions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('business_id', sa.Integer(), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(80), nullable=False),
        sa.Column('discount_percent', sa.Integer(), nullable=False),
        sa.Column('service_ids', sa.JSON(), nullable=True),
        sa.Column('weekdays', sa.JSON(), nullable=True),
        sa.Column('time_from', sa.String(5), nullable=True),
        sa.Column('time_to', sa.String(5), nullable=True),
        sa.Column('date_from', sa.Date(), nullable=True),
        sa.Column('date_to', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.CheckConstraint('discount_percent BETWEEN 1 AND 90', name='ck_promotions_percent'),
    )
    op.create_index('ix_promotions_id', 'promotions', ['id'])
    op.create_index('ix_promotions_business_id', 'promotions', ['business_id'])
    # Браузер ніколи не читає таблиці напряму (див. CLAUDE.md): RLS без політик, бекенд ходить власником
    op.execute('ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_table('promotions')
