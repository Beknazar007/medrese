"""Teacher monitoring: which timetabled lessons were expected, held or missed.

Every number on the dashboard, the monitoring page and a teacher's day-by-day log comes from
the single `_occurrences` pass below, so the three can never disagree.
"""

from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.assignment import TeachingAssignment
from app.models.assignment_teacher_change import AssignmentTeacherChange
from app.models.attendance import AttendanceRecord
from app.models.grade import GradeRecord
from app.models.lesson_session import LessonSession
from app.models.schedule import ScheduleEntry
from app.models.semester import Semester
from app.models.teacher import TeacherProfile
from app.schemas.monitoring import SessionStatus
from app.services.assignments import changes_by_assignment, responsible_teacher_id
from app.services.journal import auto_close_if_ended

BISHKEK_TZ = ZoneInfo("Asia/Bishkek")
DEFAULT_LATE_THRESHOLD = 15


def now_bishkek() -> datetime:
    """The server's "now" in Bishkek. The server itself runs in UTC, so date.today() there is
    still yesterday until 06:00 local time."""
    return datetime.now(BISHKEK_TZ)


def _resolve_now(now: datetime | None) -> datetime:
    current = now if now is not None else now_bishkek()
    if current.tzinfo is None:
        current = current.replace(tzinfo=BISHKEK_TZ)
    return current.astimezone(BISHKEK_TZ)


def _as_aware(value: datetime) -> datetime:
    # Columns are always written as UTC (datetime.now(timezone.utc)); SQLite drops the offset
    # on round-trip, so re-attach it here.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _is_late(
    checked_in_at: datetime | None, session_date: date, start_time: time, threshold: int = DEFAULT_LATE_THRESHOLD
) -> bool:
    """A teacher is "late" if they checked in more than `threshold` minutes after the
    scheduled period start, in Bishkek local time (Kyrgyzstan has no DST)."""
    if checked_in_at is None:
        return False
    expected_start = datetime.combine(session_date, start_time, tzinfo=BISHKEK_TZ)
    return (_as_aware(checked_in_at).astimezone(BISHKEK_TZ) - expected_start) > timedelta(minutes=threshold)


def _pair_ended(on_date: date, end_time: time, now: datetime) -> bool:
    return datetime.combine(on_date, end_time, tzinfo=BISHKEK_TZ) <= now


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


def clamp_period(semester: Semester, date_from: date, date_to: date, now: datetime) -> tuple[date, date]:
    """The requested period cut to the semester's dates and to today (Bishkek). An empty
    period comes back with start > end."""
    return max(date_from, semester.start_date), min(date_to, semester.end_date, now.date())


def conducted_percent(conducted: int, expected: int) -> int | None:
    """Share of expected lessons that were held, rounded half up — round() would round 88.5
    down to the even 88."""
    if expected == 0:
        return None
    return (conducted * 200 + expected) // (2 * expected)


_EXPECTED_STATUSES = {SessionStatus.CONDUCTED, SessionStatus.CONDUCTED_BY_MARK, SessionStatus.MISSED}
_CONDUCTED_STATUSES = {SessionStatus.CONDUCTED, SessionStatus.CONDUCTED_BY_MARK}


@dataclass
class _Occurrence:
    """One lesson (schedule entry + date) that shows up in monitoring."""

    entry: ScheduleEntry
    date: date
    teacher_id: int
    status: SessionStatus
    session: LessonSession | None
    late: bool

    @property
    def expected(self) -> bool:
        return self.status in _EXPECTED_STATUSES

    @property
    def conducted(self) -> bool:
        return self.status in _CONDUCTED_STATUSES


def _occurrences(
    db: Session,
    *,
    semester_id: int,
    date_from: date,
    date_to: date,
    now: datetime,
    department_id: int | None = None,
    teacher_id: int | None = None,
) -> list[_Occurrence]:
    """Every lesson in the period with its status. A fixed number of queries whatever the
    size of the timetable. With `teacher_id`, only lessons that teacher answered for —
    including ones on assignments they were replaced on or took over."""
    semester = db.get(Semester, semester_id)
    if semester is None:
        return []
    start, end = clamp_period(semester, date_from, date_to, now)
    if start > end:
        return []

    entries_stmt = (
        select(ScheduleEntry)
        .options(
            selectinload(ScheduleEntry.time_slot),
            selectinload(ScheduleEntry.assignment).selectinload(TeachingAssignment.subject),
            selectinload(ScheduleEntry.assignment).selectinload(TeachingAssignment.group),
        )
        .where(ScheduleEntry.semester_id == semester_id)
    )
    if department_id is not None:
        entries_stmt = entries_stmt.join(TeacherProfile, ScheduleEntry.teacher_id == TeacherProfile.id).where(
            TeacherProfile.department_id == department_id
        )
    if teacher_id is not None:
        replaced_assignment_ids = select(AssignmentTeacherChange.assignment_id).where(
            or_(
                AssignmentTeacherChange.from_teacher_id == teacher_id,
                AssignmentTeacherChange.to_teacher_id == teacher_id,
            )
        )
        entries_stmt = entries_stmt.where(
            or_(ScheduleEntry.teacher_id == teacher_id, ScheduleEntry.assignment_id.in_(replaced_assignment_ids))
        )
    entries = list(db.scalars(entries_stmt).all())
    if not entries:
        return []

    entry_ids = [e.id for e in entries]
    sessions = {
        (s.schedule_entry_id, s.date): s
        for s in db.scalars(
            select(LessonSession).where(
                LessonSession.schedule_entry_id.in_(entry_ids),
                LessonSession.date >= start,
                LessonSession.date <= end,
            )
        ).all()
    }
    changes = changes_by_assignment(db, {e.assignment_id for e in entries})
    threshold = DEFAULT_LATE_THRESHOLD

    result: list[_Occurrence] = []
    for entry in entries:
        slot = entry.time_slot
        entry_changes = changes.get(entry.assignment_id, [])
        for d in _expected_dates(entry.day_of_week.value, start, end):
            session = sessions.get((entry.id, d))
            # After a teacher replacement, each date counts for whoever was responsible then.
            responsible = responsible_teacher_id(entry, d, entry_changes, session.teacher_id if session else None)
            if teacher_id is not None and responsible != teacher_id:
                continue
            if session is not None:
                # An opened lesson is always expected, even while its pair is still running.
                status = SessionStatus.CONDUCTED
            elif not _pair_ended(d, slot.end_time, now):
                # Not missed yet: the teacher may still open it.
                continue
            else:
                status = SessionStatus.MISSED
            result.append(
                _Occurrence(
                    entry=entry,
                    date=d,
                    teacher_id=responsible,
                    status=status,
                    session=session,
                    late=session is not None
                    and _is_late(session.teacher_checked_in_at, d, slot.start_time, threshold),
                )
            )
    return result


@dataclass
class TeacherMonitoringRow:
    teacher_id: int
    full_name: str
    department_id: int
    expected_lessons: int
    conducted_lessons: int
    missed_lessons: int
    late_lessons: int
    conducted_percent: int | None


def _sort_key(row: TeacherMonitoringRow):
    # Worst percent first; ties — more misses first, then by name; "—" (nothing expected) last.
    percent = row.conducted_percent
    return (percent is None, percent or 0, -row.missed_lessons, row.full_name.casefold())


def teacher_monitoring(
    db: Session,
    *,
    semester_id: int,
    date_from: date,
    date_to: date,
    department_id: int | None = None,
    now: datetime | None = None,
) -> list[TeacherMonitoringRow]:
    """Per-teacher lesson counts in the period (cut to the semester and to now): expected,
    conducted, missed, late and the conducted percent, worst percent first."""
    occurrences = _occurrences(
        db,
        semester_id=semester_id,
        date_from=date_from,
        date_to=date_to,
        now=_resolve_now(now),
        department_id=department_id,
    )

    totals: dict[int, Counter] = {}
    for occ in occurrences:
        bucket = totals.setdefault(occ.teacher_id, Counter())
        bucket["expected"] += occ.expected
        bucket["conducted"] += occ.conducted
        bucket["late"] += occ.late
    if not totals:
        return []

    teachers = {t.id: t for t in db.scalars(select(TeacherProfile).where(TeacherProfile.id.in_(totals.keys()))).all()}
    rows = [
        TeacherMonitoringRow(
            teacher_id=tid,
            full_name=teachers[tid].full_name,
            department_id=teachers[tid].department_id,
            expected_lessons=counts["expected"],
            conducted_lessons=counts["conducted"],
            missed_lessons=counts["expected"] - counts["conducted"],
            late_lessons=counts["late"],
            conducted_percent=conducted_percent(counts["conducted"], counts["expected"]),
        )
        for tid, counts in totals.items()
        if tid in teachers
    ]
    rows.sort(key=_sort_key)
    return rows


@dataclass
class TeacherMonitoringSummary:
    expected_lessons: int
    conducted_lessons: int
    missed_lessons: int
    late_lessons: int
    conducted_percent: int | None
    lowest_percent: list[TeacherMonitoringRow]
    # Deprecated: the old dashboard's "most missed" list. Kept only so a frontend released
    # before this backend keeps working; the new one reads lowest_percent.
    top_missed: list[TeacherMonitoringRow]


def teacher_monitoring_summary(
    db: Session,
    *,
    semester_id: int,
    date_from: date,
    date_to: date,
    department_id: int | None = None,
    now: datetime | None = None,
) -> TeacherMonitoringSummary:
    """School-wide (or department-wide) rollup of teacher_monitoring for the dashboard —
    literally the sums of its rows, so the two pages always agree."""
    rows = teacher_monitoring(
        db, semester_id=semester_id, date_from=date_from, date_to=date_to, department_id=department_id, now=now
    )
    expected = sum(r.expected_lessons for r in rows)
    conducted = sum(r.conducted_lessons for r in rows)
    return TeacherMonitoringSummary(
        expected_lessons=expected,
        conducted_lessons=conducted,
        missed_lessons=sum(r.missed_lessons for r in rows),
        late_lessons=sum(r.late_lessons for r in rows),
        conducted_percent=conducted_percent(conducted, expected),
        lowest_percent=[r for r in rows if r.conducted_percent is not None and r.conducted_percent < 100][:5],
        top_missed=sorted((r for r in rows if r.missed_lessons > 0), key=lambda r: r.missed_lessons, reverse=True)[
            :5
        ],
    )


@dataclass
class TeacherSessionLogRow:
    date: date
    schedule_entry_id: int
    subject_name: str
    group_name: str
    status: SessionStatus
    # True for CONDUCTED and CONDUCTED_BY_MARK; kept for a frontend released before `status`.
    conducted: bool
    checked_in_at: datetime | None
    checked_out_at: datetime | None
    late: bool


def teacher_session_log(
    db: Session,
    *,
    teacher_id: int,
    semester_id: int,
    date_from: date,
    date_to: date,
    now: datetime | None = None,
) -> list[TeacherSessionLogRow]:
    """Day-by-day log for one teacher: exactly the lessons counted in their monitoring row,
    newest first, with check-in/check-out timestamps of the ones that were opened."""
    current = _resolve_now(now)
    occurrences = _occurrences(
        db, semester_id=semester_id, date_from=date_from, date_to=date_to, now=current, teacher_id=teacher_id
    )
    rows: list[TeacherSessionLogRow] = []
    for occ in occurrences:
        session = occ.session
        if session is not None:
            auto_close_if_ended(session, now=current)
        rows.append(
            TeacherSessionLogRow(
                date=occ.date,
                schedule_entry_id=occ.entry.id,
                subject_name=occ.entry.assignment.subject.name,
                group_name=occ.entry.assignment.group.name,
                status=occ.status,
                conducted=occ.conducted,
                checked_in_at=session.teacher_checked_in_at if session else None,
                checked_out_at=session.teacher_checked_out_at if session else None,
                late=occ.late,
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
    now: datetime | None = None,
) -> StudentAttendanceSummary:
    """School-wide (or department-wide) attendance-status breakdown and average grade across
    every AttendanceRecord/GradeRecord whose lesson falls in the period (cut to the semester
    and to today, Bishkek) — the student-side counterpart to teacher_monitoring.
    """
    semester = db.get(Semester, semester_id)
    if semester is None:
        return StudentAttendanceSummary(present=0, absent=0, late=0, excused=0, average_score=None)
    start, end = clamp_period(semester, date_from, date_to, _resolve_now(now))

    attendance_stmt = (
        select(AttendanceRecord.status)
        .join(LessonSession, LessonSession.id == AttendanceRecord.session_id)
        .join(ScheduleEntry, ScheduleEntry.id == LessonSession.schedule_entry_id)
        .where(
            ScheduleEntry.semester_id == semester_id,
            LessonSession.date >= start,
            LessonSession.date <= end,
        )
    )
    grade_stmt = (
        select(GradeRecord.score)
        .join(LessonSession, LessonSession.id == GradeRecord.session_id)
        .join(ScheduleEntry, ScheduleEntry.id == LessonSession.schedule_entry_id)
        .where(
            ScheduleEntry.semester_id == semester_id,
            LessonSession.date >= start,
            LessonSession.date <= end,
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
