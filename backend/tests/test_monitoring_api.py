"""HTTP-level rights and scoping of the monitoring and dashboard endpoints."""

from datetime import date, datetime, time, timezone

import pytest
from sqlalchemy.orm import Session

from app.models.enums import DayOfWeek, GroupType, UserRole
from app.models.timeslot import TimeSlot
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
    make_subject,
    make_teacher,
    make_time_slot,
    make_user,
)

def _params(w, semester_id: int | None = None) -> dict:
    return {
        "semester_id": semester_id if semester_id is not None else w["semester"].id,
        "date_from": "2026-09-01",
        "date_to": "2026-09-30",
    }


def _world(db: Session):
    dep_a = make_department(db, "A")
    dep_b = make_department(db, "B")
    teacher_a = make_teacher(db, dep_a, "teacher_a")
    teacher_b = make_teacher(db, dep_b, "teacher_b")
    hafiz = make_teacher(db, dep_a, "hafiz")
    semester = make_semester(db)
    room = make_room(db)
    slot = make_time_slot(db)
    for i, (teacher, dep, group_type, day) in enumerate(
        [
            (teacher_a, dep_a, GroupType.REGULAR, DayOfWeek.MONDAY),
            (teacher_b, dep_b, GroupType.REGULAR, DayOfWeek.TUESDAY),
            (hafiz, dep_a, GroupType.HAFIZ, DayOfWeek.WEDNESDAY),
        ]
    ):
        subject = make_subject(db, dep, code=f"S{i}")
        group = make_group(db, dep, name=f"G{i}", group_type=group_type)
        make_schedule_entry(db, make_assignment(db, teacher, subject, group, semester), room, slot, day)
    return {
        "dep_a": dep_a,
        "dep_b": dep_b,
        "teacher_a": teacher_a,
        "teacher_b": teacher_b,
        "hafiz": hafiz,
        "semester": semester,
        "rector": make_rector(db),
        "dean_a": make_dean(db, dep_a, "dean_a"),
        "dean_none": make_user(db, "dean_none", UserRole.DEAN),
    }


def _urls(w) -> list[str]:
    return [
        "/api/v1/monitoring/teachers",
        f"/api/v1/monitoring/teachers/{w['teacher_a'].id}/sessions",
        "/api/v1/dashboard/teacher-monitoring-summary",
        "/api/v1/dashboard/student-attendance-summary",
    ]


def test_rector_sees_all_departments(db: Session, client_as):
    w = _world(db)
    client = client_as(w["rector"])
    for url in _urls(w):
        assert client.get(url, params=_params(w)).status_code == 200, url
    rows = client.get(_urls(w)[0], params=_params(w)).json()
    assert {r["teacher_id"] for r in rows} == {w["teacher_a"].id, w["teacher_b"].id, w["hafiz"].id}
    summary = client.get(_urls(w)[2], params=_params(w)).json()
    assert summary["expected_lessons"] == sum(r["expected_lessons"] for r in rows)
    other_log = client.get(
        f"/api/v1/monitoring/teachers/{w['teacher_b'].id}/sessions", params=_params(w)
    )
    assert other_log.status_code == 200


def test_dean_sees_only_own_department(db: Session, client_as):
    w = _world(db)
    client = client_as(w["dean_a"])
    for url in _urls(w):
        assert client.get(url, params=_params(w)).status_code == 200, url
    rows = client.get(_urls(w)[0], params=_params(w)).json()
    assert {r["teacher_id"] for r in rows} == {w["teacher_a"].id, w["hafiz"].id}
    summary = client.get(_urls(w)[2], params=_params(w)).json()
    assert summary["expected_lessons"] == sum(r["expected_lessons"] for r in rows)
    assert summary["missed_lessons"] == sum(r["missed_lessons"] for r in rows)


def test_dean_cannot_open_other_department_teacher_log(db: Session, client_as):
    w = _world(db)
    response = client_as(w["dean_a"]).get(
        f"/api/v1/monitoring/teachers/{w['teacher_b'].id}/sessions", params=_params(w)
    )
    assert response.status_code == 403


def test_dean_without_department_is_forbidden(db: Session, client_as):
    w = _world(db)
    client = client_as(w["dean_none"])
    for url in _urls(w):
        assert client.get(url, params=_params(w)).status_code == 403, url


@pytest.mark.parametrize("who", ["teacher_a", "hafiz"])
def test_teachers_are_forbidden(db: Session, client_as, who):
    w = _world(db)
    client = client_as(w[who].user)
    for url in _urls(w):
        assert client.get(url, params=_params(w)).status_code == 403, url


def test_unknown_semester_is_404(db: Session, client_as):
    w = _world(db)
    client = client_as(w["rector"])
    for url in _urls(w):
        assert client.get(url, params=_params(w, semester_id=999)).status_code == 404, url


def test_unknown_teacher_log_is_404(db: Session, client_as):
    w = _world(db)
    response = client_as(w["rector"]).get(
        "/api/v1/monitoring/teachers/999/sessions", params=_params(w)
    )
    assert response.status_code == 404


def test_dates_are_required(db: Session, client_as):
    w = _world(db)
    response = client_as(w["rector"]).get("/api/v1/monitoring/teachers", params={"semester_id": w["semester"].id})
    assert response.status_code == 422


def test_responses_carry_percent_status_and_lowest_percent(db: Session, client_as, monkeypatch):
    w = _world(db)
    monkeypatch.setattr(monitoring_service, "now_bishkek", lambda: bishkek(date(2026, 11, 13), 12))
    client = client_as(w["rector"])

    rows = client.get("/api/v1/monitoring/teachers", params=_params(w)).json()
    assert all(r["conducted_percent"] == 0 for r in rows)  # nothing was opened in September

    summary = client.get("/api/v1/dashboard/teacher-monitoring-summary", params=_params(w)).json()
    assert summary["conducted_percent"] == 0
    assert summary["attention_lessons"] == 0
    assert all(r["attention_lessons"] == 0 for r in rows)
    assert [r["teacher_id"] for r in summary["lowest_percent"]] == [r["teacher_id"] for r in rows]
    assert "top_missed" in summary

    log = client.get(f"/api/v1/monitoring/teachers/{w['teacher_a'].id}/sessions", params=_params(w)).json()
    assert {r["status"] for r in log} == {"MISSED"}
    assert all(r["schedule_entry_id"] for r in log)
    assert all(r["conducted"] is False for r in log)
    assert all(r["no_student_marks"] is False and r["early_finish"] is False for r in log)


def test_endpoint_uses_bishkek_now(db: Session, client_as, monkeypatch):
    """Spec 1.9 end to end: at 23:30 UTC on the 13th it is already 05:30 on the 14th in
    Bishkek — Friday's pair has ended and counts, Saturday's 08:00 pair does not yet."""
    dep = make_department(db, "Solo")
    teacher = make_teacher(db, dep, "solo")
    semester = make_semester(db)
    room = make_room(db, "solo-room")
    friday_slot = make_time_slot(db)
    saturday_slot = TimeSlot(order=2, start_time=time(8, 0), end_time=time(8, 45))
    db.add(saturday_slot)
    db.flush()
    for i, (day, slot) in enumerate([(DayOfWeek.FRIDAY, friday_slot), (DayOfWeek.SATURDAY, saturday_slot)]):
        subject = make_subject(db, dep, code=f"SOLO{i}")
        group = make_group(db, dep, name=f"SOLO{i}")
        make_schedule_entry(db, make_assignment(db, teacher, subject, group, semester), room, slot, day)

    monkeypatch.setattr(
        monitoring_service, "now_bishkek", lambda: datetime(2026, 11, 13, 23, 30, tzinfo=timezone.utc)
    )
    params = {"semester_id": semester.id, "date_from": "2026-11-13", "date_to": "2026-11-14"}
    client = client_as(make_rector(db))
    [row] = client.get("/api/v1/monitoring/teachers", params=params).json()
    assert (row["expected_lessons"], row["missed_lessons"]) == (1, 1)
    log = client.get(f"/api/v1/monitoring/teachers/{teacher.id}/sessions", params=params).json()
    assert [r["date"] for r in log] == ["2026-11-13"]
