"""teacher replacement history: lesson_sessions.teacher_id + assignment_teacher_changes

Replacing the teacher of a timetabled assignment rewrites schedule_entries.teacher_id. To keep
already-held lessons (journal, student history, monitoring) with the teacher who held them,
each lesson now records its own teacher, and replacements are logged with the date they take
effect so missed lessons before that date stay with the previous teacher.

Revision ID: 3b9e6d1f2a40
Revises: c5d2f8a1e347
Create Date: 2026-11-10 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3b9e6d1f2a40'
down_revision: Union[str, None] = 'c5d2f8a1e347'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'assignment_teacher_changes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('assignment_id', sa.Integer(), nullable=False),
        sa.Column('from_teacher_id', sa.Integer(), nullable=False),
        sa.Column('to_teacher_id', sa.Integer(), nullable=False),
        sa.Column('effective_from', sa.Date(), nullable=False),
        sa.Column('changed_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['assignment_id'], ['teaching_assignments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['from_teacher_id'], ['teacher_profiles.id']),
        sa.ForeignKeyConstraint(['to_teacher_id'], ['teacher_profiles.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_assignment_teacher_changes_assignment_id'), 'assignment_teacher_changes', ['assignment_id'], unique=False
    )

    # Nullable first so existing rows can be backfilled, then tightened.
    op.add_column('lesson_sessions', sa.Column('teacher_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'lesson_sessions_teacher_id_fkey', 'lesson_sessions', 'teacher_profiles', ['teacher_id'], ['id']
    )

    # No replacements have happened before this revision, so the schedule entry's current
    # teacher is exactly who held every existing lesson.
    lesson_sessions = sa.table(
        'lesson_sessions', sa.column('schedule_entry_id', sa.Integer()), sa.column('teacher_id', sa.Integer())
    )
    schedule_entries = sa.table('schedule_entries', sa.column('id', sa.Integer()), sa.column('teacher_id', sa.Integer()))
    op.execute(
        sa.update(lesson_sessions).values(
            teacher_id=sa.select(schedule_entries.c.teacher_id)
            .where(schedule_entries.c.id == lesson_sessions.c.schedule_entry_id)
            .scalar_subquery()
        )
    )

    op.alter_column('lesson_sessions', 'teacher_id', existing_type=sa.Integer(), nullable=False)
    op.create_index('ix_lesson_sessions_teacher_id_date', 'lesson_sessions', ['teacher_id', 'date'], unique=False)


def downgrade() -> None:
    # Only the "who held it" marks of lessons after a replacement are lost; lessons and
    # attendance stay, and reports fall back to the schedule entry's current teacher.
    op.drop_index('ix_lesson_sessions_teacher_id_date', table_name='lesson_sessions')
    op.drop_constraint('lesson_sessions_teacher_id_fkey', 'lesson_sessions', type_='foreignkey')
    op.drop_column('lesson_sessions', 'teacher_id')
    op.drop_index(op.f('ix_assignment_teacher_changes_assignment_id'), table_name='assignment_teacher_changes')
    op.drop_table('assignment_teacher_changes')
