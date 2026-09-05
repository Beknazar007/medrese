from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.assignment import TeachingAssignment
from app.models.schedule import ScheduleEntry
from app.models.subject import Subject
from app.models.teacher import TeacherProfile


@dataclass
class TeacherWorkload:
    teacher_id: int
    full_name: str
    department_id: int
    assignment_count: int
    weekly_scheduled_periods: int


def teacher_workload(db: Session, *, semester_id: int, department_id: int | None = None) -> list[TeacherWorkload]:
    """Weekly teaching-hour totals per teacher for a given semester, for the rector's dashboard.
    `weekly_scheduled_periods` counts actual timetable slots; `assignment_count` counts
    teaching assignments regardless of whether they've been placed on the timetable yet —
    the gap between the two is what "schedule completeness" reports on.
    """
    assignment_counts = (
        select(TeachingAssignment.teacher_id, func.count(TeachingAssignment.id).label("count"))
        .where(TeachingAssignment.semester_id == semester_id)
        .group_by(TeachingAssignment.teacher_id)
        .subquery()
    )
    schedule_counts = (
        select(ScheduleEntry.teacher_id, func.count(ScheduleEntry.id).label("count"))
        .where(ScheduleEntry.semester_id == semester_id)
        .group_by(ScheduleEntry.teacher_id)
        .subquery()
    )

    stmt = (
        select(
            TeacherProfile.id,
            TeacherProfile.full_name,
            TeacherProfile.department_id,
            func.coalesce(assignment_counts.c.count, 0),
            func.coalesce(schedule_counts.c.count, 0),
        )
        .outerjoin(assignment_counts, assignment_counts.c.teacher_id == TeacherProfile.id)
        .outerjoin(schedule_counts, schedule_counts.c.teacher_id == TeacherProfile.id)
    )
    if department_id is not None:
        stmt = stmt.where(TeacherProfile.department_id == department_id)

    return [
        TeacherWorkload(
            teacher_id=row[0],
            full_name=row[1],
            department_id=row[2],
            assignment_count=row[3],
            weekly_scheduled_periods=row[4],
        )
        for row in db.execute(stmt).all()
    ]


def unassigned_subjects(db: Session, *, semester_id: int, department_id: int | None = None) -> list[Subject]:
    """Subjects with no TeachingAssignment in the given semester — coverage gaps for the rector."""
    assigned_subject_ids = select(TeachingAssignment.subject_id).where(
        TeachingAssignment.semester_id == semester_id
    )
    stmt = select(Subject).where(Subject.id.not_in(assigned_subject_ids))
    if department_id is not None:
        stmt = stmt.where(Subject.department_id == department_id)
    return list(db.scalars(stmt).all())
