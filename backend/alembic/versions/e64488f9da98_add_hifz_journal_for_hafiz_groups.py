"""add hifz journal for hafiz groups

Revision ID: e64488f9da98
Revises: 1c4108d2de78
Create Date: 2026-09-10 23:27:12.108851

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'e64488f9da98'
down_revision: Union[str, None] = '1c4108d2de78'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    group_type_enum = postgresql.ENUM('REGULAR', 'HAFIZ', name='group_type')
    group_type_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'groups',
        sa.Column('group_type', group_type_enum, nullable=False, server_default='REGULAR'),
    )

    hifz_kind_enum = postgresql.ENUM('HIFZ', 'REPEAT', name='hifz_kind')
    hifz_kind_enum.create(op.get_bind(), checkfirst=True)
    hifz_kind_col = postgresql.ENUM('HIFZ', 'REPEAT', name='hifz_kind', create_type=False)

    op.create_table(
        'hifz_targets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('kind', hifz_kind_col, nullable=False),
        sa.Column('juz_from', sa.Integer(), nullable=True),
        sa.Column('juz_to', sa.Integer(), nullable=True),
        sa.Column('page_from', sa.Integer(), nullable=True),
        sa.Column('page_to', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('note', sa.String(length=1000), nullable=True),
        sa.CheckConstraint('juz_to IS NULL OR juz_from IS NULL OR juz_to >= juz_from', name='ck_hifz_target_juz_range'),
        sa.CheckConstraint(
            'page_to IS NULL OR page_from IS NULL OR page_to >= page_from', name='ck_hifz_target_page_range'
        ),
        sa.CheckConstraint('end_date >= start_date', name='ck_hifz_target_date_range'),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'hifz_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('kind', hifz_kind_col, nullable=False),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('juz', sa.Integer(), nullable=True),
        sa.Column('page_from', sa.Integer(), nullable=True),
        sa.Column('page_to', sa.Integer(), nullable=True),
        sa.Column('comment', sa.String(length=1000), nullable=True),
        sa.CheckConstraint('score IS NULL OR (score >= 0 AND score <= 100)', name='ck_hifz_record_score_range'),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id', 'date', 'kind', name='uq_hifz_record_student_date_kind'),
    )

    op.create_table(
        'hifz_exams',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('juz_from', sa.Integer(), nullable=True),
        sa.Column('juz_to', sa.Integer(), nullable=True),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('comment', sa.String(length=1000), nullable=True),
        sa.CheckConstraint('score IS NULL OR (score >= 0 AND score <= 100)', name='ck_hifz_exam_score_range'),
        sa.CheckConstraint('juz_to IS NULL OR juz_from IS NULL OR juz_to >= juz_from', name='ck_hifz_exam_juz_range'),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('hifz_exams')
    op.drop_table('hifz_records')
    op.drop_table('hifz_targets')
    postgresql.ENUM(name='hifz_kind').drop(op.get_bind(), checkfirst=True)

    op.drop_column('groups', 'group_type')
    postgresql.ENUM(name='group_type').drop(op.get_bind(), checkfirst=True)
