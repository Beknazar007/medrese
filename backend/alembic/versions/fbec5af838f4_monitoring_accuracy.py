"""monitoring accuracy: non_working_days, lesson_marks, app_settings

Three new tables for honest teacher monitoring: holidays/vacations when unopened lessons
aren't expected, the rector's/dean's reason on a missed lesson (held anyway / excused /
cancelled), and a single-row settings table holding the late threshold (default 15 minutes).

Downgrade drops the three tables: only non-working days, lesson marks and the late threshold
entered after the upgrade are lost. Lessons, attendance and grades are not touched.

Revision ID: fbec5af838f4
Revises: 3b9e6d1f2a40
Create Date: 2026-11-13 01:59:45.734334

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'fbec5af838f4'
down_revision: Union[str, None] = '3b9e6d1f2a40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    app_settings = op.create_table(
        'app_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('late_threshold_minutes', sa.Integer(), server_default='15', nullable=False),
        sa.CheckConstraint('id = 1', name='ck_app_settings_single_row'),
        sa.CheckConstraint('late_threshold_minutes BETWEEN 0 AND 60', name='ck_app_settings_late_threshold'),
        sa.PrimaryKeyConstraint('id'),
    )
    # The one and only settings row, with the threshold the app used before this revision.
    op.bulk_insert(app_settings, [{'id': 1, 'late_threshold_minutes': 15}])

    op.create_table(
        'non_working_days',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('end_date >= start_date', name='ck_non_working_day_range'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_non_working_days_start_end', 'non_working_days', ['start_date', 'end_date'], unique=False)

    op.create_table(
        'lesson_marks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('schedule_entry_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('kind', sa.Enum('FORGOT_TO_OPEN', 'EXCUSED', 'CANCELLED', name='lesson_mark_kind'), nullable=False),
        sa.Column('comment', sa.String(length=500), nullable=True),
        sa.Column('marked_by_user_id', sa.Integer(), nullable=True),
        sa.Column('marked_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['marked_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['schedule_entry_id'], ['schedule_entries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('schedule_entry_id', 'date', name='uq_lesson_mark_entry_date'),
    )


def downgrade() -> None:
    op.drop_table('lesson_marks')
    # Postgres keeps the enum type after its table is gone; drop it so a re-upgrade can create it.
    sa.Enum(name='lesson_mark_kind').drop(op.get_bind(), checkfirst=True)
    op.drop_index('ix_non_working_days_start_end', table_name='non_working_days')
    op.drop_table('non_working_days')
    op.drop_table('app_settings')
