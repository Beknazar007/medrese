"""Reasons on missed lessons: «forgot to open», «excused», «cancelled» (spec 2.8–2.15, 2.24–2.29)."""

from datetime import date, datetime, timezone

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.attendance import AttendanceRecord
from app.models.enums import AttendanceStatus, LessonMarkKind, UserRole
from app.models.grade import GradeRecord
from app.models.lesson_mark import LessonMark
from app.models.lesson_session import LessonSession
from app.models.non_working_day import NonWorkingDay
from app.models.schedule import ScheduleEntry
from app.models.semester import Semester
from app.services import assignments as assignment_service
from app.services import monitoring as monitoring_service
from tests.factories import (
    bishkek,
    make_assignment,
    make_dean,
    make_department,
    make_group,
    make_rector,
    make_room,
    make_schedule_entry,
    make_semester,
    make_session,
    make_student,
    make_subject,
    make_teacher,
    make_time_slot,
    make_user,
)

URL = "/api/v1/monitoring/lesson-marks"
NOW = bishkek(date(2026, 11, 13), 12)
MONDAYS = monitoring_service._expected_dates(1, date(2026, 9, 1), date(2026, 11, 9))  # ten Mondays
MISSED_1, MISSED_2 = MONDAYS[8], MONDAYS[9]  # 2.11 and 9.11


@pytest.fixture()
def w(db: Session, monkeypatch):
    """Teacher A (department A): ten Mondays, eight held, two missed — the spec's 10/8/2."""
    monkeypatch.setattr(monitoring_service, "now_bishkek", lambda: NOW)
    dep_a = make_department(db, "A")
    dep_b = make_department(db, "B")
    teacher_a = make_teacher(db, dep_a, "teacher_a")
    teacher_b = make_teacher(db, dep_b, "teacher_b")
    semester = make_semester(db)
    slot = make_time_slot(db)
    entries = {}
    for i, (teacher, dep) in enumerate([(teacher_a, dep_a), (teacher_b, dep_b)]):
        group = make_group(db, dep, name=f"G{i}")
        assignment = make_assignment(db, teacher, make_subject(db, dep, code=f"S{i}"), group, semester)
        entries[teacher.id] = make_schedule_entry(db, assignment, make_room(db, f"R{i}"), slot)
    entry_a = entries[teacher_a.id]
    for d in MONDAYS[:8]:
        make_session(db, entry_a, d)
    return {
        "dep_a": dep_a,
        "dep_b": dep_b,
        "teacher_a": teacher_a,
        "teacher_b": teacher_b,
        "semester": semester,
        "entry_a": entry_a,
        "entry_b": entries[teacher_b.id],
        "rector": make_rector(db),
        "dean_a": make_dean(db, dep_a, "dean_a"),
        "dean_b": make_dean(db, dep_b, "dean_b"),
    }


def _row(db: Session, w, teacher_key="teacher_a"):
    rows = monitoring_service.teacher_monitoring(
        db, semester_id=w["semester"].id, date_from=date(2026, 9, 1), date_to=date(2026, 11, 13), now=NOW
    )
    row = next(r for r in rows if r.teacher_id == w[teacher_key].id)
    return row.expected_lessons, row.conducted_lessons, row.missed_lessons, row.conducted_percent


def _log(db: Session, w, teacher_key="teacher_a"):
    return {
        r.date: r
        for r in monitoring_service.teacher_session_log(
            db,
            teacher_id=w[teacher_key].id,
            semester_id=w["semester"].id,
            date_from=date(2026, 9, 1),
            date_to=date(2026, 11, 13),
            now=NOW,
        )
    }


def _put(client, entry, on_date, kind="FORGOT_TO_OPEN", comment=None):
    body = {"schedule_entry_id": entry.id, "date": on_date.isoformat(), "kind": kind}
    if comment is not None:
        body["comment"] = comment
    return client.put(URL, json=body)


def test_one_mark_per_lesson(db: Session, w):
    now = datetime.now(timezone.utc)
    entry_id = w["entry_a"].id
    db.add(LessonMark(schedule_entry_id=entry_id, date=MISSED_1, kind=LessonMarkKind.EXCUSED, marked_at=now))
    db.flush()
    db.add(LessonMark(schedule_entry_id=entry_id, date=MISSED_1, kind=LessonMarkKind.CANCELLED, marked_at=now))
    with pytest.raises(IntegrityError):
        db.flush()


def test_forgot_to_open_counts_as_conducted(db: Session, client_as, w):
    assert _row(db, w) == (10, 8, 2, 80)

    response = _put(client_as(w["rector"]), w["entry_a"], MISSED_1, comment="  Was there, phone broke ")
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "FORGOT_TO_OPEN"
    assert body["comment"] == "Was there, phone broke"
    assert body["marked_by"] == "rector"

    assert _row(db, w) == (10, 9, 1, 90)
    row = _log(db, w)[MISSED_1]
    assert row.status == "CONDUCTED_BY_MARK"
    assert row.conducted is True
    assert row.late is False
    assert row.checked_in_at is None
    assert row.mark.kind == LessonMarkKind.FORGOT_TO_OPEN
    assert row.mark.comment == "Was there, phone broke"
    assert row.mark.marked_by == "rector"
    assert row.mark.marked_at is not None
    assert row.can_mark is True


@pytest.mark.parametrize("kind", ["EXCUSED", "CANCELLED"])
def test_excused_or_cancelled_lesson_is_not_expected(db: Session, client_as, w, kind):
    assert _put(client_as(w["rector"]), w["entry_a"], MISSED_1, kind=kind).status_code == 200

    assert _row(db, w) == (9, 8, 1, 89)
    row = _log(db, w)[MISSED_1]  # still listed, with the reason as its status
    assert row.status == kind
    assert row.conducted is False
    assert row.can_mark is True


def test_change_and_remove_a_mark(db: Session, client_as, w):
    first = _put(client_as(w["dean_a"]), w["entry_a"], MISSED_1, kind="EXCUSED")
    assert first.json()["marked_by"] == "dean_a"

    second = _put(client_as(w["rector"]), w["entry_a"], MISSED_1, kind="CANCELLED", comment="Storm")
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]  # same mark, new reason
    assert (second.json()["kind"], second.json()["marked_by"], second.json()["comment"]) == (
        "CANCELLED",
        "rector",
        "Storm",
    )
    assert db.scalar(select(func.count()).select_from(LessonMark)) == 1

    assert client_as(w["rector"]).delete(f"{URL}/{first.json()['id']}").status_code == 204
    assert _row(db, w) == (10, 8, 2, 80)
    row = _log(db, w)[MISSED_1]
    assert (row.status, row.mark) == ("MISSED", None)
    assert client_as(w["rector"]).delete(f"{URL}/{first.json()['id']}").status_code == 404


def test_can_mark_only_on_unopened_lessons(db: Session, client_as, w):
    _put(client_as(w["rector"]), w["entry_a"], MISSED_1, kind="FORGOT_TO_OPEN")
    _put(client_as(w["rector"]), w["entry_a"], MISSED_2, kind="EXCUSED")
    log = _log(db, w)
    assert {d: r.can_mark for d, r in log.items()} == {**{d: False for d in MONDAYS[:8]}, MISSED_1: True, MISSED_2: True}
    assert _log(db, w, "teacher_b")[MISSED_1].can_mark is True  # plain MISSED


def test_opened_lesson_cannot_be_marked(db: Session, client_as, w):
    response = _put(client_as(w["rector"]), w["entry_a"], MONDAYS[0])
    assert (response.status_code, response.json()["detail"]) == (409, "lesson_opened")


def test_lesson_not_ended_cannot_be_marked(db: Session, client_as, w, monkeypatch):
    client = client_as(w["rector"])
    future = date(2026, 11, 16)
    response = _put(client, w["entry_b"], future)
    assert (response.status_code, response.json()["detail"]) == (409, "lesson_not_ended")

    # Today's pair (08:00–08:50) at 08:30 is still running.
    monkeypatch.setattr(monitoring_service, "now_bishkek", lambda: bishkek(MISSED_2, 8, 30))
    response = _put(client, w["entry_b"], MISSED_2)
    assert (response.status_code, response.json()["detail"]) == (409, "lesson_not_ended")
    monkeypatch.setattr(monitoring_service, "now_bishkek", lambda: bishkek(MISSED_2, 8, 50))
    assert _put(client, w["entry_b"], MISSED_2).status_code == 200


@pytest.mark.parametrize("on_date", [date(2026, 8, 31), date(2027, 1, 4)])
def test_date_outside_semester_cannot_be_marked(db: Session, client_as, w, monkeypatch, on_date):
    monkeypatch.setattr(monitoring_service, "now_bishkek", lambda: bishkek(date(2027, 2, 1), 12))
    response = _put(client_as(w["rector"]), w["entry_b"], on_date)
    assert (response.status_code, response.json()["detail"]) == (409, "outside_semester")


def test_non_working_day_cannot_be_marked(db: Session, client_as, w):
    db.add(NonWorkingDay(name="Holiday", start_date=MISSED_1, end_date=MISSED_1))
    response = _put(client_as(w["rector"]), w["entry_b"], MISSED_1)
    assert (response.status_code, response.json()["detail"]) == (409, "non_working_day")


def test_mark_on_a_day_later_declared_non_working_is_ignored(db: Session, client_as, w):
    assert _put(client_as(w["rector"]), w["entry_a"], MISSED_1, kind="FORGOT_TO_OPEN").status_code == 200
    db.add(NonWorkingDay(name="Holiday", start_date=MISSED_1, end_date=MISSED_1))
    db.flush()
    assert _row(db, w) == (9, 8, 1, 89)
    assert MISSED_1 not in _log(db, w)


def test_invalid_payloads_are_422(db: Session, client_as, w):
    client = client_as(w["rector"])
    tuesday = date(2026, 11, 3)
    assert (_put(client, w["entry_b"], tuesday).status_code, _put(client, w["entry_b"], tuesday).json()["detail"]) == (
        422,
        "wrong_weekday",
    )
    assert _put(client, w["entry_b"], MISSED_1, comment="x" * 501).status_code == 422
    assert _put(client, w["entry_b"], MISSED_1, comment="x" * 500).status_code == 200
    assert _put(client, w["entry_b"], MISSED_1, kind="FOO").status_code == 422
    missing = client.put(URL, json={"schedule_entry_id": 999, "date": MISSED_1.isoformat(), "kind": "EXCUSED"})
    assert missing.status_code == 404


def _counts(db: Session) -> tuple[int, int, int]:
    return (
        db.scalar(select(func.count()).select_from(LessonSession)),
        db.scalar(select(func.count()).select_from(AttendanceRecord)),
        db.scalar(select(func.count()).select_from(GradeRecord)),
    )


def test_mark_creates_no_lesson_attendance_or_grades(db: Session, client_as, w):
    student = make_student(db, w["entry_a"].assignment.group)
    session = db.scalar(select(LessonSession).where(LessonSession.date == MONDAYS[0]))
    db.add(AttendanceRecord(session_id=session.id, student_id=student.id, status=AttendanceStatus.PRESENT))
    db.flush()
    before = _counts(db)

    def attendance():
        return monitoring_service.student_attendance_summary(
            db, semester_id=w["semester"].id, date_from=date(2026, 9, 1), date_to=date(2026, 11, 13), now=NOW
        )

    summary_before = attendance()
    client = client_as(w["rector"])
    assert _put(client, w["entry_a"], MISSED_1, kind="FORGOT_TO_OPEN").status_code == 200
    assert _put(client, w["entry_a"], MISSED_2, kind="CANCELLED").status_code == 200
    assert _counts(db) == before
    assert attendance() == summary_before


def test_previous_semester_dates_can_be_marked(db: Session, client_as, w):
    old = Semester(name="2026 Spring", start_date=date(2026, 2, 1), end_date=date(2026, 6, 30), is_active=False)
    db.add(old)
    db.flush()
    teacher = w["teacher_a"]
    dep = w["dep_a"]
    assignment = make_assignment(db, teacher, make_subject(db, dep, code="OLD"), make_group(db, dep, "OLD"), old)
    entry = make_schedule_entry(db, assignment, make_room(db, "OLD"), make_time_slot(db, order=2))
    assert _put(client_as(w["rector"]), entry, date(2026, 6, 29), kind="EXCUSED").status_code == 200


def test_deleting_schedule_entry_deletes_its_marks(db: Session, client_as, w):
    client = client_as(w["rector"])
    assert _put(client, w["entry_b"], MISSED_1, kind="EXCUSED").status_code == 200
    assert client.delete(f"/api/v1/schedule/{w['entry_b'].id}").status_code == 204
    assert db.get(ScheduleEntry, w["entry_b"].id) is None
    assert db.scalars(select(LessonMark)).all() == []


def test_rector_marks_any_department(db: Session, client_as, w):
    client = client_as(w["rector"])
    assert _put(client, w["entry_a"], MISSED_1).status_code == 200
    assert _put(client, w["entry_b"], MISSED_1).status_code == 200


def test_dean_marks_own_department_only(db: Session, client_as, w):
    rector_mark = _put(client_as(w["rector"]), w["entry_b"], MISSED_2, kind="EXCUSED").json()
    dean = client_as(w["dean_a"])
    own = _put(dean, w["entry_a"], MISSED_1, kind="EXCUSED")
    assert own.status_code == 200
    assert _put(dean, w["entry_a"], MISSED_1, kind="CANCELLED").status_code == 200
    assert dean.delete(f"{URL}/{own.json()['id']}").status_code == 204

    assert _put(dean, w["entry_b"], MISSED_1).status_code == 403
    assert dean.delete(f"{URL}/{rector_mark['id']}").status_code == 403
    assert db.get(LessonMark, rector_mark["id"]) is not None


def test_dean_without_department_and_teachers_are_forbidden(db: Session, client_as, w):
    mark = _put(client_as(w["rector"]), w["entry_a"], MISSED_1, kind="EXCUSED").json()
    for user in (make_user(db, "dean_none", UserRole.DEAN), w["teacher_a"].user, w["teacher_b"].user):
        client = client_as(user)
        assert _put(client, w["entry_a"], MISSED_2).status_code == 403, user.username
        assert client.delete(f"{URL}/{mark['id']}").status_code == 403, user.username


def test_mark_follows_teacher_responsible_on_that_date(db: Session, client_as, w):
    """2.15: teacher B (department B) takes over B's lessons from teacher A2 (department A)
    on 21.09 — marks on earlier dates belong to A2, later ones to B."""
    a2 = make_teacher(db, w["dep_a"], "teacher_a2")
    assignment = make_assignment(
        db, a2, make_subject(db, w["dep_a"], code="SW"), make_group(db, w["dep_a"], "GW"), w["semester"]
    )
    entry = make_schedule_entry(db, assignment, make_room(db, "RW"), make_time_slot(db, order=3))
    assignment_service.replace_teacher(
        db, assignment=assignment, new_teacher_id=w["teacher_b"].id, changed_by_user_id=None,
        effective_from=date(2026, 9, 21),
    )
    assignment.teacher_id = w["teacher_b"].id
    db.flush()
    db.refresh(entry)
    before_b = _row(db, w, "teacher_b")

    # client_as switches the acting user for every client, so build one right before each call.
    early, late = date(2026, 9, 14), date(2026, 9, 28)
    assert _put(client_as(w["dean_b"]), entry, early, kind="EXCUSED").status_code == 403
    assert _put(client_as(w["dean_a"]), entry, early, kind="EXCUSED").status_code == 200
    assert _put(client_as(w["dean_a"]), entry, late, kind="EXCUSED").status_code == 403
    assert _put(client_as(w["dean_b"]), entry, late, kind="EXCUSED").status_code == 200

    log_a2 = {
        r.date: r.status
        for r in monitoring_service.teacher_session_log(
            db, teacher_id=a2.id, semester_id=w["semester"].id, date_from=date(2026, 9, 1),
            date_to=date(2026, 9, 30), now=NOW,
        )
    }
    assert log_a2 == {date(2026, 9, 7): "MISSED", early: "EXCUSED"}
    exp_b, _, missed_b, _ = _row(db, w, "teacher_b")
    assert (exp_b, missed_b) == (before_b[0] - 1, before_b[2] - 1)


def test_log_endpoint_returns_mark_and_can_mark(db: Session, client_as, w):
    _put(client_as(w["rector"]), w["entry_a"], MISSED_1, kind="EXCUSED", comment="Ill")
    params = {"semester_id": w["semester"].id, "date_from": "2026-09-01", "date_to": "2026-11-13"}
    log = client_as(w["rector"]).get(f"/api/v1/monitoring/teachers/{w['teacher_a'].id}/sessions", params=params)
    assert log.status_code == 200
    rows = {r["date"]: r for r in log.json()}
    marked = rows[MISSED_1.isoformat()]
    assert (marked["status"], marked["can_mark"], marked["conducted"]) == ("EXCUSED", True, False)
    assert {k: marked["mark"][k] for k in ("kind", "comment", "marked_by")} == {
        "kind": "EXCUSED",
        "comment": "Ill",
        "marked_by": "rector",
    }
    opened = rows[MONDAYS[0].isoformat()]
    assert (opened["status"], opened["can_mark"], opened["mark"]) == ("CONDUCTED", False, None)
