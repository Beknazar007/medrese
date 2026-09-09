"""add extended teacher profile fields

Revision ID: f34f1a41f7c0
Revises: 26e0cf631433
Create Date: 2026-09-09 14:15:56.596592

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f34f1a41f7c0'
down_revision: Union[str, None] = '26e0cf631433'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('teacher_profiles', sa.Column('photo', sa.Text(), nullable=True))
    op.add_column('teacher_profiles', sa.Column('education', sa.Text(), nullable=True))
    op.add_column('teacher_profiles', sa.Column('competency', sa.Text(), nullable=True))
    op.add_column('teacher_profiles', sa.Column('teaching_experience_years', sa.Integer(), nullable=True))
    op.add_column('teacher_profiles', sa.Column('previous_subjects', sa.Text(), nullable=True))
    op.add_column('teacher_profiles', sa.Column('can_teach', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('teacher_profiles', 'can_teach')
    op.drop_column('teacher_profiles', 'previous_subjects')
    op.drop_column('teacher_profiles', 'teaching_experience_years')
    op.drop_column('teacher_profiles', 'competency')
    op.drop_column('teacher_profiles', 'education')
    op.drop_column('teacher_profiles', 'photo')
