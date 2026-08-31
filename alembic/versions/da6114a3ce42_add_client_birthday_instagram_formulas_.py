"""add client birthday, instagram, formulas, consents

Revision ID: da6114a3ce42
Revises: c16c2baee17c
Create Date: 2026-08-31 10:10:27.350846

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'da6114a3ce42'
down_revision: Union[str, Sequence[str], None] = 'c16c2baee17c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('clients', sa.Column('birthday', sa.Date(), nullable=True))
    op.add_column('clients', sa.Column('instagram', sa.String(), nullable=True))
    op.add_column('clients', sa.Column('formulas', sa.Text(), nullable=True))
    op.add_column('clients', sa.Column('consent_photo', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('clients', sa.Column('consent_procedure', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('clients', 'consent_procedure')
    op.drop_column('clients', 'consent_photo')
    op.drop_column('clients', 'formulas')
    op.drop_column('clients', 'instagram')
    op.drop_column('clients', 'birthday')
