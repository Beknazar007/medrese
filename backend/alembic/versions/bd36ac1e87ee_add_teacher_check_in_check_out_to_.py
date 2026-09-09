"""add teacher check-in/check-out to lesson sessions

Revision ID: bd36ac1e87ee
Revises: f34f1a41f7c0
Create Date: 2026-09-09 15:23:02.815581

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'bd36ac1e87ee'
down_revision: Union[str, None] = 'f34f1a41f7c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('lesson_sessions', sa.Column('teacher_checked_in_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('lesson_sessions', sa.Column('teacher_checked_out_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('lesson_sessions', 'teacher_checked_out_at')
    op.drop_column('lesson_sessions', 'teacher_checked_in_at')
