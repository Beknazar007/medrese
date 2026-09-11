"""add student bio and per-lesson attendance comment

Revision ID: ad67d52723bb
Revises: 904c51abf624
Create Date: 2026-09-11 12:22:04.482054

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ad67d52723bb'
down_revision: Union[str, None] = '904c51abf624'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('students', sa.Column('bio', sa.String(length=2000), nullable=True))
    op.add_column('attendance_records', sa.Column('comment', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column('attendance_records', 'comment')
    op.drop_column('students', 'bio')
