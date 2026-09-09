from datetime import date, datetime, timezone

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models.assignment import TeachingAssignment
from app.models.attendance import AttendanceRecord
from app.models.grade import GradeRecord
from app.models.lesson_session import LessonSession
from app.models.schedule import ScheduleEntry
from app.models.student import Student
from app.models.subject import Subject
from app.models.teacher import TeacherProfile
from app.schemas.journal import AttendanceUpsert, GradeUpsert, RosterStudentOut, StudentHistoryRow, StudentPerformanceRow


def get_or_create_session(db: Session, *, schedule_entry: ScheduleEntry, on_date: date) -> LessonSession:
    """Also doubles as the teacher's check-in: the first time this lesson's date is opened,
    teacher_checked_in_at is stamped — re-opening the same date later doesn't move it.
    """
    session = db.scalar(
        select(LessonSession).where(
            LessonSession.schedule_entry_id == schedule_entry.id,
            LessonSession.date == on_date,
        )
    )
    if session is not None:
        return session

    session = LessonSession(
        schedule_entry_id=schedule_entry.id, date=on_date, teacher_checked_in_at=datetime.now(timezone.utc)
    )
    db.add(session)
    db.flush()
    return session


def check_out_session(session: LessonSession) -> None:
    session.teacher_checked_out_at = datetime.now(timezone.utc)


def roster_for_session(db: Session, session: LessonSession) -> list[RosterStudentOut]:
    group_id = session.schedule_entry.assignment.group_id
    students = db.scalars(
        select(Student).where(Student.group_id == group_id, Student.is_active.is_(True)).order_by(Student.full_name)
    ).all()

    attendance_by_student = {
        a.student_id: a.status
        for a in db.scalars(select(AttendanceRecord).where(AttendanceRecord.session_id == session.id))
    }
    grades_by_student = {
        g.student_id: g.score for g in db.scalars(select(GradeRecord).where(GradeRecord.session_id == session.id))
    }

    return [
        RosterStudentOut(
            student_id=s.id,
            full_name=s.full_name,
            student_number=s.student_number,
            attendance_status=attendance_by_student.get(s.id),
            score=grades_by_student.get(s.id),
        )
        for s in students
    ]


def upsert_attendance(db: Session, *, session: LessonSession, records: list[AttendanceUpsert]) -> None:
    existing = {
        a.student_id: a
        for a in db.scalars(select(AttendanceRecord).where(AttendanceRecord.session_id == session.id))
    }
    for record in records:
        if record.student_id in existing:
            existing[record.student_id].status = record.status
        else:
            db.add(AttendanceRecord(session_id=session.id, student_id=record.student_id, status=record.status))


def upsert_grades(db: Session, *, session: LessonSession, records: list[GradeUpsert]) -> None:
    existing = {g.student_id: g for g in db.scalars(select(GradeRecord).where(GradeRecord.session_id == session.id))}
    for record in records:
        if record.student_id in existing:
            existing[record.student_id].score = record.score
        else:
            db.add(GradeRecord(session_id=session.id, student_id=record.student_id, score=record.score))


def student_performance(db: Session, *, assignment_id: int) -> list[StudentPerformanceRow]:
    """Per-student average score and attendance breakdown across every LessonSession
    that has ever been held for this teaching assignment."""
    session_ids = list(
        db.scalars(
            select(LessonSession.id)
            .join(ScheduleEntry, ScheduleEntry.id == LessonSession.schedule_entry_id)
            .where(ScheduleEntry.assignment_id == assignment_id)
        )
    )
    if not session_ids:
        return []

    group_id = db.scalar(
        select(ScheduleEntry.group_id).join(LessonSession, LessonSession.schedule_entry_id == ScheduleEntry.id).limit(1)
    )
    students = db.scalars(select(Student).where(Student.group_id == group_id).order_by(Student.full_name)).all()

    rows: list[StudentPerformanceRow] = []
    for student in students:
        grades = list(
            db.scalars(
                select(GradeRecord.score).where(
                    GradeRecord.student_id == student.id, GradeRecord.session_id.in_(session_ids)
                )
            )
        )
        attendance = list(
            db.scalars(
                select(AttendanceRecord.status).where(
                    AttendanceRecord.student_id == student.id, AttendanceRecord.session_id.in_(session_ids)
                )
            )
        )
        rows.append(
            StudentPerformanceRow(
                student_id=student.id,
                full_name=student.full_name,
                average_score=round(sum(grades) / len(grades), 1) if grades else None,
                sessions_count=len(session_ids),
                present_count=sum(1 for a in attendance if a.value == "PRESENT"),
                absent_count=sum(1 for a in attendance if a.value == "ABSENT"),
                late_count=sum(1 for a in attendance if a.value == "LATE"),
                excused_count=sum(1 for a in attendance if a.value == "EXCUSED"),
            )
        )
    return rows


def student_history(
    db: Session, *, student_id: int, group_id: int, teacher_id: int | None = None
) -> list[StudentHistoryRow]:
    """Every lesson ever held for the student's group, with that student's own grade and
    attendance status for each (both None if the lesson hasn't been marked yet). Passing
    teacher_id restricts this to lessons that teacher taught; omit it for the full history
    across every subject and teacher.
    """
    stmt = (
        select(
            LessonSession.id,
            LessonSession.date,
            TeachingAssignment.subject_id,
            Subject.name,
            TeachingAssignment.teacher_id,
            TeacherProfile.full_name,
            TeachingAssignment.hour_type,
            TeachingAssignment.semester_id,
            GradeRecord.score,
            AttendanceRecord.status,
        )
        .join(ScheduleEntry, ScheduleEntry.id == LessonSession.schedule_entry_id)
        .join(TeachingAssignment, TeachingAssignment.id == ScheduleEntry.assignment_id)
        .join(Subject, Subject.id == TeachingAssignment.subject_id)
        .join(TeacherProfile, TeacherProfile.id == TeachingAssignment.teacher_id)
        .outerjoin(
            GradeRecord,
            and_(GradeRecord.session_id == LessonSession.id, GradeRecord.student_id == student_id),
        )
        .outerjoin(
            AttendanceRecord,
            and_(AttendanceRecord.session_id == LessonSession.id, AttendanceRecord.student_id == student_id),
        )
        .where(TeachingAssignment.group_id == group_id)
        .order_by(LessonSession.date.desc())
    )
    if teacher_id is not None:
        stmt = stmt.where(TeachingAssignment.teacher_id == teacher_id)

    return [
        StudentHistoryRow(
            session_id=row.id,
            date=row.date,
            subject_id=row.subject_id,
            subject_name=row.name,
            teacher_id=row.teacher_id,
            teacher_name=row.full_name,
            hour_type=row.hour_type,
            semester_id=row.semester_id,
            score=row.score,
            attendance_status=row.status,
        )
        for row in db.execute(stmt).all()
    ]
