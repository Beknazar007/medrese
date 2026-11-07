from sqlalchemy.orm import Session

from app.models.enums import DayOfWeek
from app.services.workload import teacher_workload, unassigned_subjects
from tests.factories import (
    make_assignment,
    make_department,
    make_group,
    make_room,
    make_schedule_entry,
    make_semester,
    make_subject,
    make_teacher,
    make_time_slot,
)


def test_teacher_workload_counts_assignments(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    subject = make_subject(db, department)
    group = make_group(db, department)
    semester = make_semester(db)
    make_assignment(db, teacher, subject, group, semester)

    results = teacher_workload(db, semester_id=semester.id)

    assert len(results) == 1
    assert results[0].teacher_id == teacher.id
    assert results[0].assignment_count == 1
    assert results[0].weekly_scheduled_periods == 0  # not yet placed on the timetable
    assert results[0].placed_assignment_count == 0


def test_teacher_workload_counts_placed_assignments_not_periods(db: Session):
    # One assignment on three weekly slots and one not placed at all: 3 periods, 1 of 2 placed —
    # the dashboard's coverage is 50%, not 3/2 = 150%.
    department = make_department(db)
    teacher = make_teacher(db, department)
    group = make_group(db, department)
    semester = make_semester(db)
    placed = make_assignment(db, teacher, make_subject(db, department, code="A1"), group, semester)
    make_assignment(db, teacher, make_subject(db, department, code="B1"), group, semester)
    room = make_room(db)
    for i, day in enumerate([DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY], start=1):
        make_schedule_entry(db, placed, room, make_time_slot(db, order=i), day_of_week=day)

    [row] = teacher_workload(db, semester_id=semester.id)

    assert (row.assignment_count, row.weekly_scheduled_periods, row.placed_assignment_count) == (2, 3, 1)


def test_unassigned_subjects_excludes_subjects_with_an_assignment(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    covered_subject = make_subject(db, department, code="MTH101")
    uncovered_subject = make_subject(db, department, code="PHY101")
    group = make_group(db, department)
    semester = make_semester(db)
    make_assignment(db, teacher, covered_subject, group, semester)

    results = unassigned_subjects(db, semester_id=semester.id)

    assert [s.id for s in results] == [uncovered_subject.id]
