"""client bonuses and gift certificate purchase

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-09-24 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e6f7a8b9c0d1'
down_revision: Union[str, Sequence[str], None] = 'd5e6f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'client_bonuses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('client_email', sa.String(), nullable=True),
        sa.Column('client_phone_tail', sa.String(), nullable=True),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('appointment_id', sa.Integer(), sa.ForeignKey('appointments.id'), nullable=True),
        sa.Column('business_id', sa.Integer(), sa.ForeignKey('businesses.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        # Один запис кожного типу на візит: повторне «завершено» не
        # нарахує бонус удруге.
        sa.UniqueConstraint('appointment_id', 'reason', name='uq_client_bonus_appt_reason'),
    )
    op.create_index('ix_client_bonuses_email', 'client_bonuses', ['client_email'])
    op.create_index('ix_client_bonuses_phone', 'client_bonuses', ['client_phone_tail'])

    op.add_column('gift_certificates', sa.Column('recipient_name', sa.String(), nullable=True))
    op.add_column('gift_certificates', sa.Column('recipient_email', sa.String(), nullable=True))
    op.add_column('gift_certificates', sa.Column('purchaser_user_id', sa.String(), nullable=True))
    op.add_column('gift_certificates', sa.Column('payment_id', sa.Integer(), sa.ForeignKey('payments.id'), nullable=True))
    op.create_index('ix_gift_certificates_recipient_email', 'gift_certificates', ['recipient_email'])
    op.create_index('ix_gift_certificates_purchaser_user_id', 'gift_certificates', ['purchaser_user_id'])


def downgrade() -> None:
    op.drop_index('ix_gift_certificates_purchaser_user_id', 'gift_certificates')
    op.drop_index('ix_gift_certificates_recipient_email', 'gift_certificates')
    op.drop_column('gift_certificates', 'payment_id')
    op.drop_column('gift_certificates', 'purchaser_user_id')
    op.drop_column('gift_certificates', 'recipient_email')
    op.drop_column('gift_certificates', 'recipient_name')
    op.drop_index('ix_client_bonuses_phone', 'client_bonuses')
    op.drop_index('ix_client_bonuses_email', 'client_bonuses')
    op.drop_table('client_bonuses')
