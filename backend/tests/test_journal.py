from datetime import date

from sqlalchemy.orm import Session

from app.models.enums import AttendanceStatus
from app.schemas.journal import AttendanceUpsert, GradeUpsert
from app.services import journal as journal_service
from tests.factories import (
    make_assignment,
    make_department,
    make_group,
    make_room,
    make_semester,
    make_student,
    make_schedule_entry,
    make_subject,
    make_teacher,
    make_time_slot,
)


def _setup(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    subject = make_subject(db, department)
    group = make_group(db, department)
    semester = make_semester(db)
    assignment = make_assignment(db, teacher, subject, group, semester)
    room = make_room(db)
    slot = make_time_slot(db)
    entry = make_schedule_entry(db, assignment, room, slot)
    student_a = make_student(db, group, full_name="Aisha")
    student_b = make_student(db, group, full_name="Bakyt")
    return entry, assignment, student_a, student_b


def test_get_or_create_session_is_idempotent(db: Session):
    entry, _, _, _ = _setup(db)

    session1 = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    db.flush()
    session2 = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))

    assert session1.id == session2.id


def test_roster_includes_all_active_group_students_with_no_marks_yet(db: Session):
    entry, _, student_a, student_b = _setup(db)
    session = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    db.flush()

    roster = journal_service.roster_for_session(db, session)

    assert {r.student_id for r in roster} == {student_a.id, student_b.id}
    assert all(r.attendance_status is None and r.score is None for r in roster)


def test_upsert_attendance_then_grades_reflected_in_roster(db: Session):
    entry, _, student_a, student_b = _setup(db)
    session = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    db.flush()

    journal_service.upsert_attendance(
        db,
        session=session,
        records=[
            AttendanceUpsert(student_id=student_a.id, status=AttendanceStatus.PRESENT),
            AttendanceUpsert(student_id=student_b.id, status=AttendanceStatus.ABSENT),
        ],
    )
    journal_service.upsert_grades(
        db, session=session, records=[GradeUpsert(student_id=student_a.id, score=88)]
    )
    db.flush()

    roster = {r.student_id: r for r in journal_service.roster_for_session(db, session)}
    assert roster[student_a.id].attendance_status == AttendanceStatus.PRESENT
    assert roster[student_a.id].score == 88
    assert roster[student_b.id].attendance_status == AttendanceStatus.ABSENT
    assert roster[student_b.id].score is None


def test_upsert_attendance_updates_existing_record_instead_of_duplicating(db: Session):
    entry, _, student_a, _ = _setup(db)
    session = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    db.flush()

    journal_service.upsert_attendance(
        db, session=session, records=[AttendanceUpsert(student_id=student_a.id, status=AttendanceStatus.LATE)]
    )
    db.flush()
    journal_service.upsert_attendance(
        db, session=session, records=[AttendanceUpsert(student_id=student_a.id, status=AttendanceStatus.PRESENT)]
    )
    db.flush()

    roster = journal_service.roster_for_session(db, session)
    assert len(roster) == 2
    mine = next(r for r in roster if r.student_id == student_a.id)
    assert mine.attendance_status == AttendanceStatus.PRESENT


def test_student_performance_averages_scores_and_counts_attendance(db: Session):
    entry, assignment, student_a, student_b = _setup(db)

    session1 = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    db.flush()
    journal_service.upsert_grades(db, session=session1, records=[GradeUpsert(student_id=student_a.id, score=80)])
    journal_service.upsert_attendance(
        db, session=session1, records=[AttendanceUpsert(student_id=student_a.id, status=AttendanceStatus.PRESENT)]
    )
    db.flush()

    session2 = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 14))
    db.flush()
    journal_service.upsert_grades(db, session=session2, records=[GradeUpsert(student_id=student_a.id, score=90)])
    journal_service.upsert_attendance(
        db, session=session2, records=[AttendanceUpsert(student_id=student_a.id, status=AttendanceStatus.ABSENT)]
    )
    db.flush()

    rows = {r.student_id: r for r in journal_service.student_performance(db, assignment_id=assignment.id)}
    assert rows[student_a.id].average_score == 85.0
    assert rows[student_a.id].present_count == 1
    assert rows[student_a.id].absent_count == 1
    assert rows[student_b.id].average_score is None
    assert rows[student_b.id].sessions_count == 2
