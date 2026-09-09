from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

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
