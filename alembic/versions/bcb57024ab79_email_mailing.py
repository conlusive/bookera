"""Розсилки: список відписок і журнал розсилок (основа добових лімітів).

Обидві таблиці одразу під RLS без політик: пряме API Supabase до них закрите, бекенд ходить як власник.

Revision ID: bcb57024ab79
Revises: 49e9d9aefa9c
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'bcb57024ab79'
down_revision: Union[str, Sequence[str], None] = '49e9d9aefa9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'email_suppressions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('business_id', sa.Integer(), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('source', sa.String(), nullable=False, server_default='unsubscribe'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('business_id', 'email', name='uq_email_suppression'),
    )
    op.create_index('ix_email_suppressions_id', 'email_suppressions', ['id'])
    op.create_index('ix_email_suppressions_business_id', 'email_suppressions', ['business_id'])
    op.create_index('ix_email_suppressions_email', 'email_suppressions', ['email'])

    op.create_table(
        'email_campaigns',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('business_id', sa.Integer(), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('audience', sa.String(), nullable=False, server_default='all'),
        sa.Column('recipients', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(), nullable=False, server_default='queued'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_email_campaigns_id', 'email_campaigns', ['id'])
    op.create_index('ix_email_campaigns_business_id', 'email_campaigns', ['business_id'])
    op.create_index('ix_email_campaigns_created_at', 'email_campaigns', ['created_at'])

    op.execute('ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_table('email_campaigns')
    op.drop_table('email_suppressions')
