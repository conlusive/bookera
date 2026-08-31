"""staff payouts and ownership transfer

Revision ID: 06f904351d3b
Revises: da6114a3ce42
Create Date: 2026-08-31 10:20:37.022178

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '06f904351d3b'
down_revision: Union[str, Sequence[str], None] = 'da6114a3ce42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('staff_payouts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('business_id', sa.Integer(), nullable=False),
    sa.Column('staff_id', sa.String(), nullable=False),
    sa.Column('period_start', sa.DateTime(), nullable=False),
    sa.Column('period_end', sa.DateTime(), nullable=False),
    sa.Column('gross_revenue', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('commission_rate_applied', sa.Numeric(precision=5, scale=2), nullable=False),
    sa.Column('payout_amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('paid_at', sa.DateTime(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('expense_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
    sa.ForeignKeyConstraint(['expense_id'], ['expenses.id'], ),
    sa.ForeignKeyConstraint(['staff_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_staff_payouts_id'), 'staff_payouts', ['id'], unique=False)
    # consent_photo/procedure - модель раніше не оголошувала nullable=False
    # явно, хоча в БД (з попередньої міграції) вже так - усуваємо розбіжність
    # моделі й бази, а не послаблюємо базу назад.
    op.alter_column('clients', 'consent_photo', existing_type=sa.BOOLEAN(), nullable=False, existing_server_default=sa.text('false'))
    op.alter_column('clients', 'consent_procedure', existing_type=sa.BOOLEAN(), nullable=False, existing_server_default=sa.text('false'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_staff_payouts_id'), table_name='staff_payouts')
    op.drop_table('staff_payouts')
