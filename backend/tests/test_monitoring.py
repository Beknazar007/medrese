from datetime import date

from sqlalchemy.orm import Session

from app.services import journal as journal_service
from app.services import monitoring as monitoring_service
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


def _setup(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    subject = make_subject(db, department)
    group = make_group(db, department)
    semester = make_semester(db)  # 2026-09-01 .. 2026-12-31
    assignment = make_assignment(db, teacher, subject, group, semester)
    room = make_room(db)
    slot = make_time_slot(db)
    entry = make_schedule_entry(db, assignment, room, slot)  # Monday
    return department, teacher, entry, semester


def test_teacher_monitoring_counts_expected_conducted_and_missed(db: Session):
    _, teacher, entry, semester = _setup(db)

    # Mondays in September 2026: 7, 14, 21, 28. Teacher held class on the 7th and 21st only.
    journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 21))
    db.flush()

    rows = monitoring_service.teacher_monitoring(
        db,
        semester_id=semester.id,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        today=date(2026, 9, 30),
    )

    assert len(rows) == 1
    row = rows[0]
    assert row.teacher_id == teacher.id
    assert row.expected_lessons == 4
    assert row.conducted_lessons == 2
    assert row.missed_lessons == 2


def test_teacher_monitoring_clamps_to_today_so_future_lessons_arent_missed(db: Session):
    _, teacher, entry, semester = _setup(db)

    rows = monitoring_service.teacher_monitoring(
        db,
        semester_id=semester.id,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 12, 31),
        today=date(2026, 9, 14),
    )

    # Only the 7th and 14th have happened by "today" — the rest of the semester isn't missed yet.
    assert rows[0].expected_lessons == 2
    assert rows[0].missed_lessons == 2


def test_teacher_monitoring_filters_by_department(db: Session):
    department, teacher, entry, semester = _setup(db)
    other_department = make_department(db, name="Other")

    rows = monitoring_service.teacher_monitoring(
        db,
        semester_id=semester.id,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        today=date(2026, 9, 30),
        department_id=other_department.id,
    )
    assert rows == []

    rows = monitoring_service.teacher_monitoring(
        db,
        semester_id=semester.id,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        today=date(2026, 9, 30),
        department_id=department.id,
    )
    assert len(rows) == 1
    assert rows[0].teacher_id == teacher.id


def test_teacher_session_log_marks_conducted_and_missed_dates_with_timestamps(db: Session):
    _, teacher, entry, semester = _setup(db)

    session = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    journal_service.check_out_session(session)
    db.flush()

    rows = monitoring_service.teacher_session_log(
        db,
        teacher_id=teacher.id,
        semester_id=semester.id,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 14),
        today=date(2026, 9, 14),
    )

    assert [r.date for r in rows] == [date(2026, 9, 14), date(2026, 9, 7)]
    held = next(r for r in rows if r.date == date(2026, 9, 7))
    assert held.conducted is True
    assert held.checked_in_at is not None
    assert held.checked_out_at is not None

    missed = next(r for r in rows if r.date == date(2026, 9, 14))
    assert missed.conducted is False
    assert missed.checked_in_at is None
    assert missed.checked_out_at is None
