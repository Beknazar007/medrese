"""make hifz_records.juz free text (teachers write notes like "5 (Бакара)")

Revision ID: c5d2f8a1e347
Revises: a7c3e91b5d20
Create Date: 2026-10-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c5d2f8a1e347'
down_revision: Union[str, None] = 'a7c3e91b5d20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'hifz_records',
        'juz',
        existing_type=sa.Integer(),
        type_=sa.String(length=50),
        existing_nullable=True,
        postgresql_using='juz::varchar',
    )


def downgrade() -> None:
    # Values that aren't a plain number can't go back into an integer column — they become NULL.
    op.alter_column(
        'hifz_records',
        'juz',
        existing_type=sa.String(length=50),
        type_=sa.Integer(),
        existing_nullable=True,
        postgresql_using="CASE WHEN juz ~ '^[0-9]+$' THEN juz::integer END",
    )
