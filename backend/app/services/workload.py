from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.assignment import TeachingAssignment
from app.models.group import Group
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


@dataclass
class GroupCoverage:
    group_id: int
    group_name: str
    department_id: int
    assignment_count: int
    scheduled_assignment_count: int
    coverage_percent: int


def group_coverage(db: Session, *, semester_id: int, department_id: int | None = None) -> list[GroupCoverage]:
    """Per-group timetable completeness: what share of a group's TeachingAssignments
    in this semester have at least one ScheduleEntry placed on the timetable.
    """
    assignment_counts = (
        select(TeachingAssignment.group_id, func.count(TeachingAssignment.id).label("count"))
        .where(TeachingAssignment.semester_id == semester_id)
        .group_by(TeachingAssignment.group_id)
        .subquery()
    )
    scheduled_assignment_counts = (
        select(
            TeachingAssignment.group_id,
            func.count(func.distinct(ScheduleEntry.assignment_id)).label("count"),
        )
        .join(ScheduleEntry, ScheduleEntry.assignment_id == TeachingAssignment.id)
        .where(TeachingAssignment.semester_id == semester_id)
        .group_by(TeachingAssignment.group_id)
        .subquery()
    )

    stmt = (
        select(
            Group.id,
            Group.name,
            Group.department_id,
            func.coalesce(assignment_counts.c.count, 0),
            func.coalesce(scheduled_assignment_counts.c.count, 0),
        )
        .outerjoin(assignment_counts, assignment_counts.c.group_id == Group.id)
        .outerjoin(scheduled_assignment_counts, scheduled_assignment_counts.c.group_id == Group.id)
    )
    if department_id is not None:
        stmt = stmt.where(Group.department_id == department_id)

    results = []
    for row in db.execute(stmt).all():
        total, done = row[3], row[4]
        percent = round((done / total) * 100) if total > 0 else 0
        results.append(
            GroupCoverage(
                group_id=row[0],
                group_name=row[1],
                department_id=row[2],
                assignment_count=total,
                scheduled_assignment_count=done,
                coverage_percent=percent,
            )
        )
    return results
