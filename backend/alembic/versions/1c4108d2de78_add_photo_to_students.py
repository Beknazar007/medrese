"""add photo to students

Revision ID: 1c4108d2de78
Revises: bd36ac1e87ee
Create Date: 2026-09-09 16:03:12.143600

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '1c4108d2de78'
down_revision: Union[str, None] = 'bd36ac1e87ee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('students', sa.Column('photo', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('students', 'photo')
