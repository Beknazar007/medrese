"""Counting rules of teacher monitoring (spec monitoring-accuracy, step 1)."""

from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.enums import AttendanceStatus, DayOfWeek
from app.models.attendance import AttendanceRecord
from app.models.timeslot import TimeSlot
from app.services import monitoring as monitoring_service
from app.services.monitoring import SessionStatus, TeacherMonitoringRow, conducted_percent
from tests.factories import (
    bishkek,
    make_assignment,
    make_department,
    make_group,
    make_room,
    make_schedule_entry,
    make_semester,
    make_session,
    make_student,
    make_subject,
    make_teacher,
    make_time_slot,
)

MONDAY = date(2026, 9, 7)
TEN_MONDAYS_END = date(2026, 11, 9)  # Mondays 7.09 .. 9.11 — ten of them


class _World:
    def __init__(self, db: Session, suffix: str = ""):
        self.db = db
        self.department = make_department(db, f"Theology{suffix}")
        self.semester = make_semester(db)  # 2026-09-01 .. 2026-12-31
        self.room = make_room(db, f"101{suffix}")
        self.suffix = suffix
        self._n = 0

    def slot(self, start: time, end: time, order: int) -> TimeSlot:
        slot = TimeSlot(order=order, start_time=start, end_time=end)
        self.db.add(slot)
        self.db.flush()
        return slot

    def entry(self, teacher, slot, day=DayOfWeek.MONDAY, department=None):
        self._n += 1
        dep = department or self.department
        subject = make_subject(self.db, dep, code=f"S{self._n}{self.suffix}")
        group = make_group(self.db, dep, name=f"G{self._n}{self.suffix}")
        assignment = make_assignment(self.db, teacher, subject, group, self.semester)
        return make_schedule_entry(self.db, assignment, self.room, slot, day)

    def rows(self, date_from, date_to, now, department_id=None):
        return monitoring_service.teacher_monitoring(
            self.db,
            semester_id=self.semester.id,
            date_from=date_from,
            date_to=date_to,
            department_id=department_id,
            now=now,
        )

    def log(self, teacher, date_from, date_to, now):
        return monitoring_service.teacher_session_log(
            self.db, teacher_id=teacher.id, semester_id=self.semester.id, date_from=date_from, date_to=date_to, now=now
        )


def _ten_to_ten_forty_five(w: _World) -> TimeSlot:
    return w.slot(time(10, 0), time(10, 45), order=3)


def test_running_pair_not_expected_until_end(db: Session):
    w = _World(db)
    teacher = make_teacher(db, w.department)
    w.entry(teacher, _ten_to_ten_forty_five(w))

    now = bishkek(MONDAY, 10, 30)
    assert w.rows(MONDAY, MONDAY, now) == []
    assert w.log(teacher, MONDAY, MONDAY, now) == []


def test_ended_pair_counts_as_missed(db: Session):
    w = _World(db)
    teacher = make_teacher(db, w.department)
    w.entry(teacher, _ten_to_ten_forty_five(w))

    now = bishkek(MONDAY, 10, 46)
    [row] = w.rows(MONDAY, MONDAY, now)
    assert (row.expected_lessons, row.conducted_lessons, row.missed_lessons) == (1, 0, 1)
    [log_row] = w.log(teacher, MONDAY, MONDAY, now)
    assert log_row.status == SessionStatus.MISSED
    assert log_row.conducted is False


def test_open_running_lesson_counts_as_conducted(db: Session):
    w = _World(db)
    teacher = make_teacher(db, w.department)
    entry = w.entry(teacher, _ten_to_ten_forty_five(w))
    session = make_session(db, entry, MONDAY)
    session.teacher_checked_in_at = bishkek(MONDAY, 10, 5).astimezone(timezone.utc)
    db.flush()

    now = bishkek(MONDAY, 10, 20)
    [row] = w.rows(MONDAY, MONDAY, now)
    assert (row.expected_lessons, row.conducted_lessons, row.missed_lessons) == (1, 1, 0)
    [log_row] = w.log(teacher, MONDAY, MONDAY, now)
    assert log_row.status == SessionStatus.CONDUCTED
    assert log_row.checked_out_at is None  # still running — not auto-closed


def test_period_clamped_to_semester(db: Session):
    w = _World(db)
    teacher = make_teacher(db, w.department)
    w.entry(teacher, make_time_slot(db))

    # 24.08 and 31.08 are Mondays too, but the semester starts on 01.09.
    [row] = w.rows(date(2026, 8, 24), date(2026, 9, 7), bishkek(date(2026, 11, 13), 12))
    assert row.expected_lessons == 1
    assert [r.date for r in w.log(teacher, date(2026, 8, 24), date(2026, 9, 7), bishkek(date(2026, 11, 13), 12))] == [
        MONDAY
    ]


def test_period_clamped_to_semester_end(db: Session):
    w = _World(db)
    teacher = make_teacher(db, w.department)
    w.entry(teacher, make_time_slot(db))

    # Mondays 28.12 (in) and 04.01 (after the semester's end on 31.12).
    [row] = w.rows(date(2026, 12, 28), date(2027, 1, 10), bishkek(date(2027, 2, 1), 12))
    assert row.expected_lessons == 1


def test_period_outside_semester_returns_empty(db: Session):
    w = _World(db)
    teacher = make_teacher(db, w.department)
    w.entry(teacher, make_time_slot(db))

    now = bishkek(date(2026, 11, 13), 12)
    assert w.rows(date(2026, 8, 1), date(2026, 8, 31), now) == []
    assert w.log(teacher, date(2026, 8, 1), date(2026, 8, 31), now) == []
    summary = monitoring_service.teacher_monitoring_summary(
        db, semester_id=w.semester.id, date_from=date(2026, 8, 1), date_to=date(2026, 8, 31), now=now
    )
    assert summary.expected_lessons == 0
    assert summary.conducted_percent is None


def _hold(db, entry, dates):
    for d in dates:
        make_session(db, entry, d)


def _weekdays(day: DayOfWeek, n: int) -> list[date]:
    return monitoring_service._expected_dates(day.value, date(2026, 9, 1), date(2026, 12, 31))[:n]


def test_conducted_percent_and_sorting(db: Session):
    w = _World(db)
    slot = make_time_slot(db)
    teacher_a = make_teacher(db, w.department, "a_teacher")
    teacher_b = make_teacher(db, w.department, "b_teacher")
    teacher_c = make_teacher(db, w.department, "c_teacher")
    teacher_d = make_teacher(db, w.department, "Bek")
    teacher_e = make_teacher(db, w.department, "aibek")

    # A: 10 expected, 9 held → 90%.
    _hold(db, w.entry(teacher_a, slot, DayOfWeek.MONDAY), _weekdays(DayOfWeek.MONDAY, 9))
    # B: 10 expected, 5 held → 50%, 5 missed.
    _hold(db, w.entry(teacher_b, slot, DayOfWeek.TUESDAY), _weekdays(DayOfWeek.TUESDAY, 5))
    # C: two weekly lessons — 20 expected, 10 held → 50%, 10 missed: above B.
    _hold(db, w.entry(teacher_c, slot, DayOfWeek.WEDNESDAY), _weekdays(DayOfWeek.WEDNESDAY, 5))
    _hold(db, w.entry(teacher_c, slot, DayOfWeek.THURSDAY), _weekdays(DayOfWeek.THURSDAY, 5))
    # D and E: 50% with 5 missed like B — ordered by name, case-insensitively.
    _hold(db, w.entry(teacher_d, slot, DayOfWeek.FRIDAY), _weekdays(DayOfWeek.FRIDAY, 5))
    _hold(db, w.entry(teacher_e, slot, DayOfWeek.SATURDAY), _weekdays(DayOfWeek.SATURDAY, 5))

    # 01.09 .. 09.11 holds exactly ten of each weekday Monday..Saturday.
    rows = w.rows(date(2026, 9, 1), date(2026, 11, 9), bishkek(date(2026, 11, 13), 12))
    by_id = {r.teacher_id: r for r in rows}
    assert by_id[teacher_a.id].conducted_percent == 90
    assert by_id[teacher_b.id].conducted_percent == 50
    assert [r.full_name for r in rows] == ["c_teacher", "aibek", "b_teacher", "Bek", "a_teacher"]


def test_teachers_with_nothing_expected_sort_last():
    def row(name, percent, missed):
        return TeacherMonitoringRow(
            teacher_id=0,
            full_name=name,
            department_id=0,
            expected_lessons=0,
            conducted_lessons=0,
            missed_lessons=missed,
            late_lessons=0,
            conducted_percent=percent,
        )

    rows = [row("none", None, 0), row("full", 100, 0), row("low", 10, 1)]
    rows.sort(key=monitoring_service._sort_key)
    assert [r.full_name for r in rows] == ["low", "full", "none"]


def test_percent_rounds_half_up():
    assert conducted_percent(8, 9) == 89  # 88.9
    assert conducted_percent(177, 200) == 89  # 88.5 — round() would give the even 88
    assert conducted_percent(1, 8) == 13  # 12.5
    assert conducted_percent(1, 3) == 33
    assert conducted_percent(9, 10) == 90
    assert conducted_percent(0, 0) is None


def test_late_does_not_reduce_percent(db: Session):
    w = _World(db)
    teacher = make_teacher(db, w.department)
    entry = w.entry(teacher, make_time_slot(db))  # 08:00–08:50
    session = make_session(db, entry, MONDAY)
    session.teacher_checked_in_at = bishkek(MONDAY, 8, 30).astimezone(timezone.utc)
    db.flush()

    [row] = w.rows(MONDAY, MONDAY, bishkek(MONDAY, 23, 59))
    assert row.late_lessons == 1
    assert row.conducted_percent == 100


def test_now_is_bishkek_not_utc(db: Session):
    w = _World(db)
    teacher = make_teacher(db, w.department)
    friday, saturday = date(2026, 11, 13), date(2026, 11, 14)
    w.entry(teacher, make_time_slot(db), DayOfWeek.FRIDAY)  # 08:00–08:50
    w.entry(teacher, w.slot(time(18, 0), time(18, 45), order=9), DayOfWeek.FRIDAY)
    w.entry(teacher, w.slot(time(8, 0), time(8, 45), order=2), DayOfWeek.SATURDAY)

    # 23:30 UTC on the 13th is 05:30 on the 14th in Bishkek.
    now = datetime(2026, 11, 13, 23, 30, tzinfo=timezone.utc)
    [row] = w.rows(friday, saturday, now)
    assert row.expected_lessons == 2  # both Friday pairs; Saturday's hasn't ended yet
    assert {r.date for r in w.log(teacher, friday, saturday, now)} == {friday}


def test_now_bishkek_is_aware_in_bishkek():
    now = monitoring_service.now_bishkek()
    assert now.tzinfo == ZoneInfo("Asia/Bishkek")
    assert now.utcoffset().total_seconds() == 6 * 3600


def _mixed_world(db: Session):
    w = _World(db)
    other = make_department(db, "Other")
    slot = make_time_slot(db)
    late_slot = w.slot(time(9, 0), time(9, 45), order=2)
    t1 = make_teacher(db, w.department, "t1")
    t2 = make_teacher(db, w.department, "t2")
    t3 = make_teacher(db, other, "t3")
    _hold(db, w.entry(t1, slot, DayOfWeek.MONDAY), _weekdays(DayOfWeek.MONDAY, 3))
    late = make_session(db, w.entry(t1, late_slot, DayOfWeek.MONDAY), MONDAY)
    late.teacher_checked_in_at = bishkek(MONDAY, 9, 30).astimezone(timezone.utc)
    _hold(db, w.entry(t2, slot, DayOfWeek.TUESDAY), _weekdays(DayOfWeek.TUESDAY, 4))
    _hold(db, w.entry(t3, slot, DayOfWeek.WEDNESDAY, department=other), _weekdays(DayOfWeek.WEDNESDAY, 1))
    db.flush()
    return w, other


def test_summary_equals_sum_of_rows(db: Session):
    w, other = _mixed_world(db)
    now = bishkek(date(2026, 11, 13), 12)
    for department_id in (None, w.department.id, other.id):
        rows = w.rows(date(2026, 9, 1), date(2026, 9, 30), now, department_id=department_id)
        summary = monitoring_service.teacher_monitoring_summary(
            db,
            semester_id=w.semester.id,
            date_from=date(2026, 9, 1),
            date_to=date(2026, 9, 30),
            department_id=department_id,
            now=now,
        )
        expected = sum(r.expected_lessons for r in rows)
        conducted = sum(r.conducted_lessons for r in rows)
        assert summary.expected_lessons == expected
        assert summary.conducted_lessons == conducted
        assert summary.missed_lessons == sum(r.missed_lessons for r in rows)
        assert summary.late_lessons == sum(r.late_lessons for r in rows)
        assert summary.conducted_percent == conducted_percent(conducted, expected)
    assert summary.late_lessons == 0  # the other department has no late lesson
    all_rows = w.rows(date(2026, 9, 1), date(2026, 9, 30), now)
    assert sum(r.late_lessons for r in all_rows) == 1


def test_summary_lowest_percent_top5(db: Session):
    w = _World(db)
    now = bishkek(date(2026, 11, 13), 12)
    # Seven teachers, each with a Monday lesson — four of them in September.
    held_counts = [4, 3, 3, 2, 1, 0, 2]
    for i, held in enumerate(held_counts):
        teacher = make_teacher(db, w.department, f"t{i}")
        _hold(db, _entry_on_new_slot(w, teacher, i), _weekdays(DayOfWeek.MONDAY, held))

    summary = monitoring_service.teacher_monitoring_summary(
        db, semester_id=w.semester.id, date_from=date(2026, 9, 1), date_to=date(2026, 9, 30), now=now
    )
    assert len(summary.lowest_percent) == 5
    assert all(r.conducted_percent < 100 for r in summary.lowest_percent)
    # 0%, 25%, then 50% and 75% ties broken by name; the 100% teacher isn't listed.
    assert [r.full_name for r in summary.lowest_percent] == ["t5", "t4", "t3", "t6", "t1"]


def _entry_on_new_slot(w: _World, teacher, i: int):
    # One teacher per slot so the seven Monday lessons don't collide on the same room/slot.
    return w.entry(teacher, w.slot(time(8 + i, 0), time(8 + i, 45), order=10 + i))


def test_summary_lowest_percent_empty_without_misses(db: Session):
    w = _World(db)
    teacher = make_teacher(db, w.department)
    _hold(db, w.entry(teacher, make_time_slot(db)), _weekdays(DayOfWeek.MONDAY, 4))
    summary = monitoring_service.teacher_monitoring_summary(
        db,
        semester_id=w.semester.id,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        now=bishkek(date(2026, 11, 13), 12),
    )
    assert summary.conducted_percent == 100
    assert summary.lowest_percent == []


def test_student_attendance_summary_clamped_to_semester_and_now(db: Session):
    w = _World(db)
    teacher = make_teacher(db, w.department)
    entry = w.entry(teacher, make_time_slot(db))
    student = make_student(db, entry.assignment.group)
    for d in (date(2026, 8, 31), MONDAY, date(2026, 9, 14)):
        session = make_session(db, entry, d)
        db.add(AttendanceRecord(session_id=session.id, student_id=student.id, status=AttendanceStatus.PRESENT))
    db.flush()

    # 31.08 is before the semester, 14.09 is after "now" — only 07.09 counts.
    summary = monitoring_service.student_attendance_summary(
        db,
        semester_id=w.semester.id,
        date_from=date(2026, 8, 1),
        date_to=date(2026, 9, 30),
        now=bishkek(date(2026, 9, 7), 23, 59),
    )
    assert summary.present == 1


def _count_queries(db: Session, fn) -> int:
    count = 0

    def _on_execute(*_args, **_kwargs):
        nonlocal count
        count += 1

    engine = db.get_bind()
    event.listen(engine, "before_cursor_execute", _on_execute)
    try:
        fn()
    finally:
        event.remove(engine, "before_cursor_execute", _on_execute)
    return count


def test_monitoring_does_not_n_plus_1(db: Session):
    def queries_for(n_entries: int) -> tuple[int, int]:
        w = _World(db, suffix=f"-{n_entries}")
        teacher = make_teacher(db, w.department, f"teacher_{n_entries}")
        for i in range(n_entries):
            entry = w.entry(teacher, w.slot(time(8, i), time(8, 50), order=100 * n_entries + i))
            make_session(db, entry, MONDAY)
        db.commit()
        db.expire_all()
        now = bishkek(date(2026, 11, 13), 12)
        list_queries = _count_queries(db, lambda: w.rows(date(2026, 9, 1), date(2026, 9, 30), now))
        db.expire_all()
        log_queries = _count_queries(db, lambda: w.log(teacher, date(2026, 9, 1), date(2026, 9, 30), now))
        return list_queries, log_queries

    assert queries_for(2) == queries_for(10)
