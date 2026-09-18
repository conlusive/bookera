"""backfill provides_services

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-09-16 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, Sequence[str], None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Порожні значення = «не налаштовували», а не «не приймає записів».
    #
    # У SQL `provides_services != False` для NULL дає NULL, і рядок
    # випадає з вибірки - майстри зникали зі списку для запису, хоча
    # власник нічого не вимикав.
    #
    # Запит виправляє причину в самих даних; перевірка в коді теж
    # змінена, але лишати NULL у булевому полі однаково не варто.
    op.execute("UPDATE users SET provides_services = true WHERE provides_services IS NULL")
    op.execute("UPDATE users SET show_in_storefront = true WHERE show_in_storefront IS NULL")


def downgrade() -> None:
    # Зворотної дії немає: ми не знаємо, які саме значення були NULL,
    # і відновлювати їх навмання гірше, ніж лишити як є.
    pass
