"""add is_exam flag to lesson sessions

Revision ID: 907d18991f7d
Revises: ad67d52723bb
Create Date: 2026-09-11 12:38:54.052377

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '907d18991f7d'
down_revision: Union[str, None] = 'ad67d52723bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'lesson_sessions',
        sa.Column('is_exam', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('lesson_sessions', 'is_exam')
