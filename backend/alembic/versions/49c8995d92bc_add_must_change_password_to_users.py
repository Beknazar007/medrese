"""add must_change_password to users

Revision ID: 49c8995d92bc
Revises: 907d18991f7d
Create Date: 2026-09-22 22:32:25.054366

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '49c8995d92bc'
down_revision: Union[str, None] = '907d18991f7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('must_change_password', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('users', 'must_change_password')
