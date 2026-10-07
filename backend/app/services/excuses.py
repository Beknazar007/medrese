from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.attendance import AttendanceRecord
from app.models.enums import AttendanceStatus
from app.models.excuse import StudentExcuse
from app.models.lesson_session import LessonSession
from app.models.schedule import ScheduleEntry
from app.models.student import Student


def _mark_excused(db: Session, session_id: int, student_id: int, excuse: StudentExcuse) -> None:
    record = db.scalar(
        select(AttendanceRecord).where(AttendanceRecord.session_id == session_id, AttendanceRecord.student_id == student_id)
    )
    if record is None:
        record = AttendanceRecord(session_id=session_id, student_id=student_id, status=AttendanceStatus.EXCUSED)
        db.add(record)
    record.status = AttendanceStatus.EXCUSED
    record.comment = excuse.reason
    record.excuse_id = excuse.id
    db.flush()


def apply_to_session(db: Session, session: LessonSession) -> None:
    """Mark every student of the lesson's group who is excused on its date. Idempotent — called
    whenever a lesson is opened, so an excuse entered after the lesson was created still shows."""
    group_id = session.schedule_entry.group_id
    excuses = db.scalars(
        select(StudentExcuse)
        .join(Student, Student.id == StudentExcuse.student_id)
        .where(
            Student.group_id == group_id,
            StudentExcuse.date_from <= session.date,
            StudentExcuse.date_to >= session.date,
        )
        .order_by(StudentExcuse.id)
    ).all()
    for excuse in excuses:
        _mark_excused(db, session.id, excuse.student_id, excuse)


def resync_student(db: Session, student_id: int) -> None:
    """Re-apply all of a student's excuses to lessons already held. Run after any excuse of the
    student is created, edited or deleted (records of a deleted excuse are removed first by the
    caller, or detached by ON DELETE SET NULL)."""
    student = db.get(Student, student_id)
    if student is None:
        return
    excuses = db.scalars(
        select(StudentExcuse).where(StudentExcuse.student_id == student_id).order_by(StudentExcuse.id)
    ).all()
    for excuse in excuses:
        session_ids = db.scalars(
            select(LessonSession.id)
            .join(ScheduleEntry, ScheduleEntry.id == LessonSession.schedule_entry_id)
            .where(
                ScheduleEntry.group_id == student.group_id,
                LessonSession.date >= excuse.date_from,
                LessonSession.date <= excuse.date_to,
            )
        ).all()
        for session_id in session_ids:
            _mark_excused(db, session_id, student_id, excuse)


def remove_marks(db: Session, excuse: StudentExcuse) -> None:
    """Drop the EXCUSED records this excuse put on lessons — they go back to unmarked, for the
    teacher to fill in. Another excuse covering the same day re-marks it in resync_student."""
    db.execute(delete(AttendanceRecord).where(AttendanceRecord.excuse_id == excuse.id))
    db.flush()


def covering(db: Session, *, student_id: int, on_date: date) -> StudentExcuse | None:
    return db.scalar(
        select(StudentExcuse).where(
            StudentExcuse.student_id == student_id,
            StudentExcuse.date_from <= on_date,
            StudentExcuse.date_to >= on_date,
        )
    )
