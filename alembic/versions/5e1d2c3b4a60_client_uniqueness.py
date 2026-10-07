"""Унікальність клієнта в закладі: один номер (останні 9 цифр) і одна пошта - одна картка.

Revision ID: 5e1d2c3b4a60
Revises: 3a7c9e1b5d44
Create Date: 2026-10-07

Індекси на виразах, без нових колонок, тож код працює й до міграції. Якщо в базі вже є дублі, унікальний індекс
не створюється (інакше міграція впала б): лишається звичайний, а дублі видно у «Клієнти → Дублі» й після їх
обʼєднання міграцію достатньо повторити (downgrade/upgrade цієї ревізії).
"""
from typing import Sequence, Union

from alembic import op

revision: str = '5e1d2c3b4a60'
down_revision: Union[str, Sequence[str], None] = '3a7c9e1b5d44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PHONE = r"RIGHT(regexp_replace(phone, '\D', '', 'g'), 9)"
PHONE_WHERE = r"phone IS NOT NULL AND length(regexp_replace(phone, '\D', '', 'g')) >= 9"
EMAIL = "lower(btrim(email))"
EMAIL_WHERE = "email IS NOT NULL AND btrim(email) <> ''"


def _index(name: str, expr: str, where: str) -> str:
    return f"""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM clients WHERE {where} GROUP BY business_id, {expr} HAVING count(*) > 1) THEN
            RAISE NOTICE 'У clients є дублі: індекс {name} створено без унікальності';
            CREATE INDEX IF NOT EXISTS {name} ON clients (business_id, ({expr})) WHERE {where};
        ELSE
            CREATE UNIQUE INDEX IF NOT EXISTS {name} ON clients (business_id, ({expr})) WHERE {where};
        END IF;
    END $$;
    """


def upgrade() -> None:
    op.execute(_index("uq_clients_business_phone", PHONE, PHONE_WHERE))
    op.execute(_index("uq_clients_business_email", EMAIL, EMAIL_WHERE))


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_clients_business_phone")
    op.execute("DROP INDEX IF EXISTS uq_clients_business_email")
