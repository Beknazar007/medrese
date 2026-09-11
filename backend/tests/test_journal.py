from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.models.enums import AttendanceStatus, DayOfWeek
from app.models.grade import GradeRecord
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


def test_get_or_create_session_stamps_check_in_only_once(db: Session):
    entry, _, _, _ = _setup(db)

    session1 = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    db.flush()
    assert session1.teacher_checked_in_at is not None
    first_stamp = session1.teacher_checked_in_at

    session2 = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    assert session2.id == session1.id
    assert session2.teacher_checked_in_at == first_stamp


def test_check_out_session_stamps_checkout_time(db: Session):
    entry, _, _, _ = _setup(db)
    session = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    db.flush()
    assert session.teacher_checked_out_at is None

    journal_service.check_out_session(session)
    assert session.teacher_checked_out_at is not None


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
    journal_service.set_exam_flag(session, True)
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


def test_upsert_grades_rejected_for_a_session_not_marked_as_an_exam(db: Session):
    entry, _, student_a, _ = _setup(db)
    session = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    db.flush()
    assert session.is_exam is False

    with pytest.raises(ValueError):
        journal_service.upsert_grades(db, session=session, records=[GradeUpsert(student_id=student_a.id, score=75)])

    journal_service.set_exam_flag(session, True)
    db.flush()
    journal_service.upsert_grades(db, session=session, records=[GradeUpsert(student_id=student_a.id, score=75)])
    db.flush()

    roster = {r.student_id: r for r in journal_service.roster_for_session(db, session)}
    assert roster[student_a.id].score == 75


def test_upsert_attendance_stores_and_updates_the_per_lesson_comment(db: Session):
    entry, _, student_a, _ = _setup(db)
    session = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    db.flush()

    journal_service.upsert_attendance(
        db,
        session=session,
        records=[AttendanceUpsert(student_id=student_a.id, status=AttendanceStatus.LATE, comment="10 мүнөткө кечикти")],
    )
    db.flush()
    roster = {r.student_id: r for r in journal_service.roster_for_session(db, session)}
    assert roster[student_a.id].attendance_comment == "10 мүнөткө кечикти"

    journal_service.upsert_attendance(
        db, session=session, records=[AttendanceUpsert(student_id=student_a.id, status=AttendanceStatus.LATE, comment=None)]
    )
    db.flush()
    roster = {r.student_id: r for r in journal_service.roster_for_session(db, session)}
    assert roster[student_a.id].attendance_comment is None


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
    journal_service.set_exam_flag(session1, True)
    db.flush()
    journal_service.upsert_grades(db, session=session1, records=[GradeUpsert(student_id=student_a.id, score=80)])
    journal_service.upsert_attendance(
        db, session=session1, records=[AttendanceUpsert(student_id=student_a.id, status=AttendanceStatus.PRESENT)]
    )
    db.flush()

    session2 = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 14))
    journal_service.set_exam_flag(session2, True)
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


def test_student_performance_average_ignores_grades_left_on_non_exam_sessions(db: Session):
    """Grades recorded before the exam-only rule existed stay in the database as history,
    but a non-exam session's score must not pull the average away from the exam average."""
    entry, assignment, student_a, _ = _setup(db)

    non_exam_session = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    db.flush()
    db.add(GradeRecord(session_id=non_exam_session.id, student_id=student_a.id, score=40))
    db.flush()

    exam_session = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 14))
    journal_service.set_exam_flag(exam_session, True)
    db.flush()
    journal_service.upsert_grades(db, session=exam_session, records=[GradeUpsert(student_id=student_a.id, score=90)])
    db.flush()

    rows = {r.student_id: r for r in journal_service.student_performance(db, assignment_id=assignment.id)}
    assert rows[student_a.id].average_score == 90.0


def test_student_history_includes_every_group_session_with_this_students_own_marks(db: Session):
    entry, assignment, student_a, student_b = _setup(db)

    session1 = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 7))
    journal_service.set_exam_flag(session1, True)
    db.flush()
    journal_service.upsert_grades(db, session=session1, records=[GradeUpsert(student_id=student_a.id, score=80)])
    journal_service.upsert_attendance(
        db,
        session=session1,
        records=[
            AttendanceUpsert(student_id=student_a.id, status=AttendanceStatus.PRESENT, comment="Жакшы катышты")
        ],
    )
    db.flush()

    session2 = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=date(2026, 9, 14))
    db.flush()

    history = journal_service.student_history(
        db, student_id=student_a.id, group_id=student_a.group_id
    )
    assert [row.date for row in history] == [date(2026, 9, 14), date(2026, 9, 7)]
    graded_row = next(row for row in history if row.session_id == session1.id)
    assert graded_row.score == 80
    assert graded_row.attendance_status == AttendanceStatus.PRESENT
    assert graded_row.attendance_comment == "Жакшы катышты"
    assert graded_row.subject_id == assignment.subject_id
    assert graded_row.teacher_id == assignment.teacher_id
    assert graded_row.is_exam is True
    ungraded_row = next(row for row in history if row.session_id == session2.id)
    assert ungraded_row.score is None
    assert ungraded_row.attendance_status is None
    assert ungraded_row.attendance_comment is None
    assert ungraded_row.is_exam is False

    # A different student's marks never leak into this student's history.
    other_history = journal_service.student_history(
        db, student_id=student_b.id, group_id=student_b.group_id
    )
    assert all(row.score is None and row.attendance_status is None for row in other_history)


def test_student_history_teacher_filter_excludes_other_teachers_lessons(db: Session):
    department = make_department(db)
    group = make_group(db, department)
    semester = make_semester(db)
    student = make_student(db, group)

    teacher_a = make_teacher(db, department, username="teacher_a")
    subject_a = make_subject(db, department, code="A101")
    assignment_a = make_assignment(db, teacher_a, subject_a, group, semester)
    room = make_room(db)
    slot_a = make_time_slot(db, order=1)
    entry_a = make_schedule_entry(db, assignment_a, room, slot_a, day_of_week=DayOfWeek.MONDAY)
    session_a = journal_service.get_or_create_session(db, schedule_entry=entry_a, on_date=date(2026, 9, 7))
    db.flush()

    teacher_b = make_teacher(db, department, username="teacher_b")
    subject_b = make_subject(db, department, code="B101")
    assignment_b = make_assignment(db, teacher_b, subject_b, group, semester)
    slot_b = make_time_slot(db, order=2)
    entry_b = make_schedule_entry(db, assignment_b, room, slot_b, day_of_week=DayOfWeek.MONDAY)
    journal_service.get_or_create_session(db, schedule_entry=entry_b, on_date=date(2026, 9, 8))
    db.flush()

    history = journal_service.student_history(
        db, student_id=student.id, group_id=group.id, teacher_id=teacher_a.id
    )
    assert [row.session_id for row in history] == [session_a.id]
