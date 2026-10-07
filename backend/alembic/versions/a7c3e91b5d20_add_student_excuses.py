"""add student excuses (dean-recorded excused absences)

Revision ID: a7c3e91b5d20
Revises: 49c8995d92bc
Create Date: 2026-10-07 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c3e91b5d20'
down_revision: Union[str, None] = '49c8995d92bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'student_excuses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('date_from', sa.Date(), nullable=False),
        sa.Column('date_to', sa.Date(), nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=False),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('date_to >= date_from', name='ck_student_excuse_date_range'),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_student_excuses_student_id', 'student_excuses', ['student_id'])
    op.add_column('attendance_records', sa.Column('excuse_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_attendance_records_excuse_id', 'attendance_records', 'student_excuses', ['excuse_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_attendance_records_excuse_id', 'attendance_records', ['excuse_id'])


def downgrade() -> None:
    op.drop_index('ix_attendance_records_excuse_id', table_name='attendance_records')
    op.drop_constraint('fk_attendance_records_excuse_id', 'attendance_records', type_='foreignkey')
    op.drop_column('attendance_records', 'excuse_id')
    op.drop_index('ix_student_excuses_student_id', table_name='student_excuses')
    op.drop_table('student_excuses')
