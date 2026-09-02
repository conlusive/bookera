"""materials, inventory movements, payout cancellation

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-02 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'service_materials',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_id', sa.Integer(), nullable=False),
        sa.Column('inventory_item_id', sa.Integer(), nullable=False),
        sa.Column('quantity_per_use', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['inventory_item_id'], ['inventory_items.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('service_id', 'inventory_item_id', name='uq_service_material'),
    )
    op.create_index(op.f('ix_service_materials_id'), 'service_materials', ['id'])
    op.create_index(op.f('ix_service_materials_service_id'), 'service_materials', ['service_id'])

    op.create_table(
        'inventory_movements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('inventory_item_id', sa.Integer(), nullable=False),
        sa.Column('appointment_id', sa.Integer(), nullable=True),
        sa.Column('quantity_delta', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('cost_at_moment', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id']),
        sa.ForeignKeyConstraint(['inventory_item_id'], ['inventory_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_inventory_movements_id'), 'inventory_movements', ['id'])
    op.create_index(op.f('ix_inventory_movements_business_id'), 'inventory_movements', ['business_id'])
    op.create_index(op.f('ix_inventory_movements_appointment_id'), 'inventory_movements', ['appointment_id'])

    op.add_column('staff_payouts', sa.Column('cancelled_at', sa.DateTime(), nullable=True))
    op.add_column('staff_payouts', sa.Column('cancel_reason', sa.String(), nullable=True))
    op.add_column('staff_payouts', sa.Column('materials_cost', sa.Numeric(precision=10, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column('staff_payouts', 'materials_cost')
    op.drop_column('staff_payouts', 'cancel_reason')
    op.drop_column('staff_payouts', 'cancelled_at')
    op.drop_table('inventory_movements')
    op.drop_table('service_materials')
