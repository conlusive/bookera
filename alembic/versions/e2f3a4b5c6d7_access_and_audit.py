"""section permissions, request stages, audit log

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-09-27 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, Sequence[str], None] = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('staff_memberships', sa.Column('permissions', sa.JSON(), nullable=True))
    op.add_column('staff_requests', sa.Column('stage', sa.String(), nullable=False, server_default='owner'))
    op.add_column('staff_requests', sa.Column('escalation_note', sa.Text(), nullable=True))
    op.create_table(
        'audit_events',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('business_id', sa.Integer(), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('actor_id', sa.String(), nullable=True),
        sa.Column('actor_name', sa.String(), nullable=True),
        sa.Column('actor_role', sa.String(), nullable=True),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('meta', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_audit_events_business_created', 'audit_events', ['business_id', 'created_at'])
    op.create_index('ix_audit_events_actor', 'audit_events', ['actor_id'])


def downgrade() -> None:
    op.drop_index('ix_audit_events_actor', 'audit_events')
    op.drop_index('ix_audit_events_business_created', 'audit_events')
    op.drop_table('audit_events')
    op.drop_column('staff_requests', 'escalation_note')
    op.drop_column('staff_requests', 'stage')
    op.drop_column('staff_memberships', 'permissions')
