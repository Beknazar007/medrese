from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.attendance import AttendanceRecord
from app.models.grade import GradeRecord
from app.models.lesson_session import LessonSession
from app.models.schedule import ScheduleEntry
from app.models.teacher import TeacherProfile


def _expected_dates(day_of_week: int, start: date, end: date) -> list[date]:
    """Every date of the given weekday (DayOfWeek: MONDAY=1..SUNDAY=7) in [start, end]."""
    if start > end:
        return []
    target_weekday = day_of_week - 1  # date.weekday(): Monday=0..Sunday=6
    first = start + timedelta(days=(target_weekday - start.weekday()) % 7)
    dates = []
    current = first
    while current <= end:
        dates.append(current)
        current += timedelta(days=7)
    return dates


@dataclass
class TeacherMonitoringRow:
    teacher_id: int
    full_name: str
    department_id: int
    expected_lessons: int
    conducted_lessons: int
    missed_lessons: int


def teacher_monitoring(
    db: Session,
    *,
    semester_id: int,
    date_from: date,
    date_to: date,
    department_id: int | None = None,
    today: date | None = None,
) -> list[TeacherMonitoringRow]:
    """Per-teacher lesson counts in [date_from, date_to] (clamped to today — a lesson that
    hasn't happened yet isn't "missed"): how many weekly occurrences the timetable implies
    (expected), how many have a recorded LessonSession (conducted), and the gap (missed).
    Sorted by missed_lessons descending, for spotting who's skipping classes.
    """
    effective_to = min(date_to, today or date.today())

    entries_stmt = select(ScheduleEntry).where(ScheduleEntry.semester_id == semester_id)
    if department_id is not None:
        entries_stmt = entries_stmt.join(TeacherProfile, ScheduleEntry.teacher_id == TeacherProfile.id).where(
            TeacherProfile.department_id == department_id
        )
    entries = list(db.scalars(entries_stmt).all())
    if not entries:
        return []

    entry_ids = [e.id for e in entries]
    held_pairs = {
        (row.schedule_entry_id, row.date)
        for row in db.execute(
            select(LessonSession.schedule_entry_id, LessonSession.date).where(
                LessonSession.schedule_entry_id.in_(entry_ids),
                LessonSession.date >= date_from,
                LessonSession.date <= effective_to,
            )
        ).all()
    }

    totals: dict[int, dict[str, int]] = {}
    for entry in entries:
        bucket = totals.setdefault(entry.teacher_id, {"expected": 0, "conducted": 0})
        for d in _expected_dates(entry.day_of_week.value, date_from, effective_to):
            bucket["expected"] += 1
            if (entry.id, d) in held_pairs:
                bucket["conducted"] += 1

    teachers = {t.id: t for t in db.scalars(select(TeacherProfile).where(TeacherProfile.id.in_(totals.keys()))).all()}

    rows = [
        TeacherMonitoringRow(
            teacher_id=teacher_id,
            full_name=teachers[teacher_id].full_name,
            department_id=teachers[teacher_id].department_id,
            expected_lessons=counts["expected"],
            conducted_lessons=counts["conducted"],
            missed_lessons=counts["expected"] - counts["conducted"],
        )
        for teacher_id, counts in totals.items()
        if teacher_id in teachers
    ]
    rows.sort(key=lambda r: r.missed_lessons, reverse=True)
    return rows


@dataclass
class TeacherMonitoringSummary:
    expected_lessons: int
    conducted_lessons: int
    missed_lessons: int
    top_missed: list[TeacherMonitoringRow]


def teacher_monitoring_summary(
    db: Session,
    *,
    semester_id: int,
    date_from: date,
    date_to: date,
    department_id: int | None = None,
    today: date | None = None,
) -> TeacherMonitoringSummary:
    """School-wide (or department-wide) rollup of teacher_monitoring, for the dashboard:
    totals plus the worst offenders (already sorted by missed_lessons descending)."""
    rows = teacher_monitoring(
        db, semester_id=semester_id, date_from=date_from, date_to=date_to, department_id=department_id, today=today
    )
    return TeacherMonitoringSummary(
        expected_lessons=sum(r.expected_lessons for r in rows),
        conducted_lessons=sum(r.conducted_lessons for r in rows),
        missed_lessons=sum(r.missed_lessons for r in rows),
        top_missed=[r for r in rows if r.missed_lessons > 0][:5],
    )


@dataclass
class TeacherSessionLogRow:
    date: date
    subject_name: str
    group_name: str
    conducted: bool
    checked_in_at: datetime | None
    checked_out_at: datetime | None


def teacher_session_log(
    db: Session, *, teacher_id: int, semester_id: int, date_from: date, date_to: date, today: date | None = None
) -> list[TeacherSessionLogRow]:
    """Day-by-day log for one teacher: every expected lesson occurrence in range, with
    whether it was held and the check-in/check-out timestamps when it was."""
    effective_to = min(date_to, today or date.today())

    entries = list(
        db.scalars(
            select(ScheduleEntry).where(
                ScheduleEntry.semester_id == semester_id, ScheduleEntry.teacher_id == teacher_id
            )
        ).all()
    )
    if not entries:
        return []

    entry_ids = [e.id for e in entries]
    sessions_by_pair = {
        (s.schedule_entry_id, s.date): s
        for s in db.scalars(
            select(LessonSession).where(
                LessonSession.schedule_entry_id.in_(entry_ids),
                LessonSession.date >= date_from,
                LessonSession.date <= effective_to,
            )
        ).all()
    }

    rows: list[TeacherSessionLogRow] = []
    for entry in entries:
        subject_name = entry.assignment.subject.name
        group_name = entry.assignment.group.name
        for d in _expected_dates(entry.day_of_week.value, date_from, effective_to):
            session = sessions_by_pair.get((entry.id, d))
            rows.append(
                TeacherSessionLogRow(
                    date=d,
                    subject_name=subject_name,
                    group_name=group_name,
                    conducted=session is not None,
                    checked_in_at=session.teacher_checked_in_at if session else None,
                    checked_out_at=session.teacher_checked_out_at if session else None,
                )
            )
    rows.sort(key=lambda r: r.date, reverse=True)
    return rows


@dataclass
class StudentAttendanceSummary:
    present: int
    absent: int
    late: int
    excused: int
    average_score: float | None


def student_attendance_summary(
    db: Session,
    *,
    semester_id: int,
    date_from: date,
    date_to: date,
    department_id: int | None = None,
    today: date | None = None,
) -> StudentAttendanceSummary:
    """School-wide (or department-wide) attendance-status breakdown and average grade across
    every AttendanceRecord/GradeRecord whose lesson falls in [date_from, date_to] within this
    semester — the student-side counterpart to teacher_monitoring, for the dashboard.
    """
    effective_to = min(date_to, today or date.today())

    attendance_stmt = (
        select(AttendanceRecord.status)
        .join(LessonSession, LessonSession.id == AttendanceRecord.session_id)
        .join(ScheduleEntry, ScheduleEntry.id == LessonSession.schedule_entry_id)
        .where(
            ScheduleEntry.semester_id == semester_id,
            LessonSession.date >= date_from,
            LessonSession.date <= effective_to,
        )
    )
    grade_stmt = (
        select(GradeRecord.score)
        .join(LessonSession, LessonSession.id == GradeRecord.session_id)
        .join(ScheduleEntry, ScheduleEntry.id == LessonSession.schedule_entry_id)
        .where(
            ScheduleEntry.semester_id == semester_id,
            LessonSession.date >= date_from,
            LessonSession.date <= effective_to,
            LessonSession.is_exam.is_(True),
        )
    )
    if department_id is not None:
        attendance_stmt = attendance_stmt.join(
            TeacherProfile, TeacherProfile.id == ScheduleEntry.teacher_id
        ).where(TeacherProfile.department_id == department_id)
        grade_stmt = grade_stmt.join(TeacherProfile, TeacherProfile.id == ScheduleEntry.teacher_id).where(
            TeacherProfile.department_id == department_id
        )

    counts = Counter(status.value for status in db.scalars(attendance_stmt).all())
    scores = list(db.scalars(grade_stmt).all())

    return StudentAttendanceSummary(
        present=counts.get("PRESENT", 0),
        absent=counts.get("ABSENT", 0),
        late=counts.get("LATE", 0),
        excused=counts.get("EXCUSED", 0),
        average_score=round(sum(scores) / len(scores), 1) if scores else None,
    )
