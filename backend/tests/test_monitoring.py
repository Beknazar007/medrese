from datetime import date

from sqlalchemy.orm import Session

from app.models.enums import AttendanceStatus
from app.schemas.journal import AttendanceUpsert, GradeUpsert
from app.services import journal as journal_service
from app.services import monitoring as monitoring_service
from tests.factories import (
    make_assignment,
    make_department,
    make_group,
    make_room,
    make_schedule_entry,
    make_semester,
    make_student,
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


def test_teacher_monitoring_summary_totals_and_lists_top_missed(db: Session):
    _, teacher, entry, semester = _setup(db)

    # Mondays: 7, 14, 21, 28. Held on the 7th only — 3 missed.
    journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    db.flush()

    summary = monitoring_service.teacher_monitoring_summary(
        db,
        semester_id=semester.id,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        today=date(2026, 9, 30),
    )

    assert summary.expected_lessons == 4
    assert summary.conducted_lessons == 1
    assert summary.missed_lessons == 3
    assert len(summary.top_missed) == 1
    assert summary.top_missed[0].teacher_id == teacher.id
    assert summary.top_missed[0].missed_lessons == 3


def test_teacher_monitoring_summary_excludes_teachers_with_no_missed_lessons(db: Session):
    _, teacher, entry, semester = _setup(db)

    for d in (date(2026, 9, 7), date(2026, 9, 14), date(2026, 9, 21), date(2026, 9, 28)):
        journal_service.get_or_create_session(db, schedule_entry=entry, on_date=d)
    db.flush()

    summary = monitoring_service.teacher_monitoring_summary(
        db,
        semester_id=semester.id,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        today=date(2026, 9, 30),
    )

    assert summary.missed_lessons == 0
    assert summary.top_missed == []


def test_student_attendance_summary_counts_statuses_and_averages_grades(db: Session):
    _, _, entry, semester = _setup(db)
    group = entry.assignment.group
    student_a = make_student(db, group, full_name="Aisha")
    student_b = make_student(db, group, full_name="Bakyt")

    session1 = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    db.flush()
    journal_service.upsert_attendance(
        db,
        session=session1,
        records=[
            AttendanceUpsert(student_id=student_a.id, status=AttendanceStatus.PRESENT),
            AttendanceUpsert(student_id=student_b.id, status=AttendanceStatus.ABSENT),
        ],
    )
    journal_service.upsert_grades(db, session=session1, records=[GradeUpsert(student_id=student_a.id, score=80)])

    session2 = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 14))
    db.flush()
    journal_service.upsert_attendance(
        db, session=session2, records=[AttendanceUpsert(student_id=student_a.id, status=AttendanceStatus.LATE)]
    )
    journal_service.upsert_grades(db, session=session2, records=[GradeUpsert(student_id=student_a.id, score=90)])
    db.flush()

    summary = monitoring_service.student_attendance_summary(
        db,
        semester_id=semester.id,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        today=date(2026, 9, 30),
    )

    assert summary.present == 1
    assert summary.absent == 1
    assert summary.late == 1
    assert summary.excused == 0
    assert summary.average_score == 85.0


def test_student_attendance_summary_filters_by_department(db: Session):
    department, _, entry, semester = _setup(db)
    other_department = make_department(db, name="Other")
    group = entry.assignment.group
    student = make_student(db, group)

    session = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    db.flush()
    journal_service.upsert_attendance(
        db, session=session, records=[AttendanceUpsert(student_id=student.id, status=AttendanceStatus.PRESENT)]
    )
    db.flush()

    other_summary = monitoring_service.student_attendance_summary(
        db,
        semester_id=semester.id,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        today=date(2026, 9, 30),
        department_id=other_department.id,
    )
    assert other_summary.present == 0

    own_summary = monitoring_service.student_attendance_summary(
        db,
        semester_id=semester.id,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        today=date(2026, 9, 30),
        department_id=department.id,
    )
    assert own_summary.present == 1
