from sqlalchemy.orm import Session

from app.models.enums import DayOfWeek
from app.models.schedule import ScheduleEntry
from app.services.workload import group_coverage, teacher_workload, unassigned_subjects
from tests.factories import (
    make_assignment,
    make_department,
    make_group,
    make_room,
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


def test_group_coverage_percent(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    subject = make_subject(db, department)
    other_subject = make_subject(db, department, code="PHY101")
    group = make_group(db, department)
    semester = make_semester(db)
    scheduled_assignment = make_assignment(db, teacher, subject, group, semester)
    make_assignment(db, teacher, other_subject, group, semester)  # left unscheduled

    room = make_room(db)
    slot = make_time_slot(db)
    db.add(
        ScheduleEntry(
            assignment_id=scheduled_assignment.id,
            semester_id=semester.id,
            teacher_id=teacher.id,
            group_id=group.id,
            room_id=room.id,
            time_slot_id=slot.id,
            day_of_week=DayOfWeek.MONDAY,
        )
    )
    db.flush()

    results = group_coverage(db, semester_id=semester.id)

    assert len(results) == 1
    assert results[0].group_id == group.id
    assert results[0].assignment_count == 2
    assert results[0].scheduled_assignment_count == 1
    assert results[0].coverage_percent == 50
