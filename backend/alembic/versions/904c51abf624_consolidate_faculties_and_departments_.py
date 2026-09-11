"""consolidate faculties and departments into Ilim and Hafizdik

Revision ID: 904c51abf624
Revises: e64488f9da98
Create Date: 2026-09-11 10:48:05.400894

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '904c51abf624'
down_revision: Union[str, None] = 'e64488f9da98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # The new departments don't belong to any faculty — relax the NOT NULL constraint before
    # inserting them; the column (and the whole faculties table) is dropped later in this
    # same migration anyway.
    op.alter_column('departments', 'faculty_id', nullable=True)

    # Carry over the first dean-headed department's head onto the new "Илим" department, so
    # that dean's admin access isn't dropped by this consolidation. Any other pre-existing
    # dean loses their headed department here and must be reassigned manually afterwards.
    old_head = conn.execute(
        sa.text("SELECT head_user_id FROM departments WHERE head_user_id IS NOT NULL ORDER BY id LIMIT 1")
    ).scalar()
    # head_user_id is unique across the table — free it up before reusing it on "Илим", since
    # the old department row that currently holds it isn't deleted until later in this migration.
    conn.execute(sa.text("UPDATE departments SET head_user_id = NULL WHERE head_user_id IS NOT NULL"))

    ilim_id = conn.execute(
        sa.text("INSERT INTO departments (name, head_user_id) VALUES ('Илим', :head) RETURNING id"),
        {"head": old_head},
    ).scalar()
    hafiz_dept_id = conn.execute(
        sa.text("INSERT INTO departments (name, head_user_id) VALUES ('Хафиздик', NULL) RETURNING id")
    ).scalar()

    old_dept_ids = [
        row[0]
        for row in conn.execute(
            sa.text("SELECT id FROM departments WHERE id NOT IN (:ilim, :hafiz)"),
            {"ilim": ilim_id, "hafiz": hafiz_dept_id},
        )
    ]

    # Groups: HAFIZ-type -> Хафиздик, everything else -> Илим.
    conn.execute(sa.text("UPDATE groups SET department_id = :d WHERE group_type = 'HAFIZ'"), {"d": hafiz_dept_id})
    conn.execute(sa.text("UPDATE groups SET department_id = :d WHERE group_type = 'REGULAR'"), {"d": ilim_id})

    # Teachers/subjects: only move to Хафиздик if EVERY teaching assignment they're part of
    # points at a HAFIZ group; a mixed or assignment-less teacher/subject defaults to Илим.
    hafiz_only_teacher_ids = sa.text(
        """
        SELECT ta.teacher_id FROM teaching_assignments ta
        JOIN groups g ON g.id = ta.group_id
        GROUP BY ta.teacher_id
        HAVING bool_and(g.group_type = 'HAFIZ')
        """
    )
    conn.execute(
        sa.text(f"UPDATE teacher_profiles SET department_id = :hafiz WHERE id IN ({hafiz_only_teacher_ids.text})"),
        {"hafiz": hafiz_dept_id},
    )
    conn.execute(
        sa.text(f"UPDATE teacher_profiles SET department_id = :ilim WHERE id NOT IN ({hafiz_only_teacher_ids.text})"),
        {"ilim": ilim_id},
    )

    hafiz_only_subject_ids = sa.text(
        """
        SELECT ta.subject_id FROM teaching_assignments ta
        JOIN groups g ON g.id = ta.group_id
        GROUP BY ta.subject_id
        HAVING bool_and(g.group_type = 'HAFIZ')
        """
    )
    conn.execute(
        sa.text(f"UPDATE subjects SET department_id = :hafiz WHERE id IN ({hafiz_only_subject_ids.text})"),
        {"hafiz": hafiz_dept_id},
    )
    conn.execute(
        sa.text(f"UPDATE subjects SET department_id = :ilim WHERE id NOT IN ({hafiz_only_subject_ids.text})"),
        {"ilim": ilim_id},
    )

    # Nothing references the old departments any more — safe to remove them.
    if old_dept_ids:
        conn.execute(sa.text("DELETE FROM departments WHERE id = ANY(:ids)"), {"ids": old_dept_ids})

    op.drop_column('departments', 'faculty_id')
    op.drop_table('faculties')


def downgrade() -> None:
    op.create_table(
        'faculties',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.add_column('departments', sa.Column('faculty_id', sa.Integer(), nullable=True))

    # The Илим/Хафиздик consolidation is lossy — there's no way back to the original
    # faculties/departments. Reseed a single placeholder faculty so the NOT NULL constraint
    # can be restored without leaving existing departments dangling.
    conn = op.get_bind()
    faculty_id = conn.execute(sa.text("INSERT INTO faculties (name) VALUES ('General') RETURNING id")).scalar()
    conn.execute(sa.text("UPDATE departments SET faculty_id = :f WHERE faculty_id IS NULL"), {"f": faculty_id})

    op.alter_column('departments', 'faculty_id', nullable=False)
    op.create_foreign_key(None, 'departments', 'faculties', ['faculty_id'], ['id'])
