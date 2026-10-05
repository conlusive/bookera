"""Індекси на гарячих шляхах: відгуки, Радар, виплати, платежі, зв'язки клієнтів, власник закладу.

Усі ці стовпці фільтруються в кожному запиті каталогу чи кабінету (рейтинг закладу,
активний Радар, баланс балів, виплати), але індексів не мали - на великій таблиці це
повне сканування. IF NOT EXISTS: міграцію безпечно запускати повторно.

Revision ID: b7c8d9e0f1a2
Revises: f9a0b1c2d3e4
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, Sequence[str], None] = 'f9a0b1c2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEXES = [
    ('reviews', 'business_id'),
    ('reviews', 'appointment_id'),
    ('points_ledger', 'business_id'),
    ('referral_commissions', 'business_id'),
    ('radar_boosts', 'business_id'),
    ('payments', 'business_id'),
    ('staff_payouts', 'business_id'),
    ('staff_payouts', 'staff_id'),
    ('client_links', 'client_id'),
    ('client_links', 'linked_client_id'),
    ('businesses', 'owner_id'),
]


def upgrade() -> None:
    for table, column in INDEXES:
        op.execute(f'CREATE INDEX IF NOT EXISTS ix_{table}_{column} ON {table} ({column})')


def downgrade() -> None:
    for table, column in INDEXES:
        op.execute(f'DROP INDEX IF EXISTS ix_{table}_{column}')
