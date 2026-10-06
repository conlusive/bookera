"""Оплата комісії закладом: referral_commissions.payment_id

Раніше комісії лише накопичувались зі статусом pending і ніяк не закривались. Тепер заклад платить
накопичене карткою (як підписку чи Радар); комісії, що увійшли в платіж, прив'язуються до нього
і стають paid, коли платіж підтверджено.

Revision ID: c7d8e9f0a1b2
Revises: 47df68fdeef9
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, Sequence[str], None] = '47df68fdeef9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('referral_commissions', sa.Column('payment_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_referral_commissions_payment', 'referral_commissions', 'payments', ['payment_id'], ['id'])
    op.create_index('ix_referral_commissions_payment_id', 'referral_commissions', ['payment_id'])


def downgrade() -> None:
    op.drop_index('ix_referral_commissions_payment_id', table_name='referral_commissions')
    op.drop_constraint('fk_referral_commissions_payment', 'referral_commissions', type_='foreignkey')
    op.drop_column('referral_commissions', 'payment_id')
