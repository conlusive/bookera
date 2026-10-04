"""audit index and client categories

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-10-05 14:00:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'f9a0b1c2d3e4'
down_revision: Union[str, Sequence[str], None] = 'e8f9a0b1c2d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index('ix_audit_events_business_id_id', 'audit_events', ['business_id', 'id'])
    # Експорт, імпорт і обʼєднання клієнтів - тепер у розділі «Клієнти», а не «Налаштування»
    op.execute("UPDATE audit_events SET category = 'clients' "
               "WHERE action IN ('clients_exported', 'clients_imported', 'clients_merged')")


def downgrade() -> None:
    op.execute("UPDATE audit_events SET category = 'settings' "
               "WHERE action IN ('clients_exported', 'clients_imported', 'clients_merged')")
    op.drop_index('ix_audit_events_business_id_id', table_name='audit_events')
