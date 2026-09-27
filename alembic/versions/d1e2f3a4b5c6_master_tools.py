"""staff requests and portfolio

Revision ID: d1e2f3a4b5c6
Revises: c0d1e2f3a4b5
Create Date: 2026-09-26 14:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = 'c0d1e2f3a4b5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'staff_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('business_id', sa.Integer(), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('response_note', sa.Text(), nullable=True),
        sa.Column('decided_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('decided_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_staff_requests_business', 'staff_requests', ['business_id', 'status'])
    op.create_index('ix_staff_requests_user', 'staff_requests', ['user_id'])
    op.create_table(
        'portfolio_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('business_id', sa.Integer(), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('image_url', sa.String(), nullable=False),
        sa.Column('caption', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_portfolio_items_business', 'portfolio_items', ['business_id', 'user_id'])


def downgrade() -> None:
    op.drop_index('ix_portfolio_items_business', 'portfolio_items')
    op.drop_table('portfolio_items')
    op.drop_index('ix_staff_requests_user', 'staff_requests')
    op.drop_index('ix_staff_requests_business', 'staff_requests')
    op.drop_table('staff_requests')
