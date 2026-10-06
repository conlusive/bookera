"""Завдатки онлайн і виплати закладам (за мінусом комісії)

- appointments: deposit_status / deposit_paid / deposit_token / deposit_payment_id / deposit_payout_id
- salon_payouts: виплата закладу (брутто завдатків, вирахувана комісія, до виплати) - під RLS
- referral_commissions.payout_id: комісія, вирахувана з виплати
- businesses.payout_details: реквізити для виплат. НЕ в payments_settings: ті віддаються публічно.

Revision ID: 9b3e7a1c5d20
Revises: c7d8e9f0a1b2
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '9b3e7a1c5d20'
down_revision: Union[str, Sequence[str], None] = 'c7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'salon_payouts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('business_id', sa.Integer(), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('gross', sa.Numeric(10, 2), nullable=False),
        sa.Column('commission_offset', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_salon_payouts_id', 'salon_payouts', ['id'])
    op.create_index('ix_salon_payouts_business_id', 'salon_payouts', ['business_id'])
    op.execute('ALTER TABLE public.salon_payouts ENABLE ROW LEVEL SECURITY')

    op.add_column('appointments', sa.Column('deposit_status', sa.String(), nullable=True))
    op.add_column('appointments', sa.Column('deposit_paid', sa.Numeric(10, 2), nullable=True))
    op.add_column('appointments', sa.Column('deposit_token', sa.String(), nullable=True))
    op.add_column('appointments', sa.Column('deposit_payment_id', sa.Integer(), sa.ForeignKey('payments.id'), nullable=True))
    op.add_column('appointments', sa.Column('deposit_payout_id', sa.Integer(), sa.ForeignKey('salon_payouts.id'), nullable=True))
    op.create_index('ix_appointments_deposit_status', 'appointments', ['deposit_status'])

    op.add_column('referral_commissions', sa.Column('payout_id', sa.Integer(), sa.ForeignKey('salon_payouts.id'), nullable=True))
    op.add_column('businesses', sa.Column('payout_details', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('businesses', 'payout_details')
    op.drop_column('referral_commissions', 'payout_id')
    op.drop_index('ix_appointments_deposit_status', table_name='appointments')
    op.drop_column('appointments', 'deposit_payout_id')
    op.drop_column('appointments', 'deposit_payment_id')
    op.drop_column('appointments', 'deposit_token')
    op.drop_column('appointments', 'deposit_paid')
    op.drop_column('appointments', 'deposit_status')
    op.drop_table('salon_payouts')
