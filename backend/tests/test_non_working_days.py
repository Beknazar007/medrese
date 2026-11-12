from datetime import date, timezone

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.enums import DayOfWeek
from app.models.non_working_day import NonWorkingDay
from app.services import journal as journal_service
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
    make_subject,
    make_teacher,
    make_time_slot,
)

URL = "/api/v1/non-working-days"
MONDAY = date(2026, 9, 7)
NOW = bishkek(date(2026, 11, 13), 12)
NOORUZ = {"name": "Nooruz", "start_date": "2027-03-21", "end_date": "2027-03-21"}


def _world(db: Session):
    dep_a = make_department(db, "A")
    dep_b = make_department(db, "B")
    teacher_a = make_teacher(db, dep_a, "teacher_a")
    teacher_b = make_teacher(db, dep_b, "teacher_b")
    semester = make_semester(db)
    slot = make_time_slot(db)
    entries = {}
    for i, (teacher, dep) in enumerate([(teacher_a, dep_a), (teacher_b, dep_b)]):
        assignment = make_assignment(
            db, teacher, make_subject(db, dep, code=f"S{i}"), make_group(db, dep, name=f"G{i}"), semester
        )
        entries[teacher.id] = make_schedule_entry(db, assignment, make_room(db, f"R{i}"), slot, DayOfWeek.MONDAY)
    return {"semester": semester, "teacher_a": teacher_a, "teacher_b": teacher_b, "entries": entries}


def _counts(db: Session, w) -> dict[int, tuple[int, int, int]]:
    rows = monitoring_service.teacher_monitoring(
        db, semester_id=w["semester"].id, date_from=date(2026, 9, 1), date_to=date(2026, 9, 30), now=NOW
    )
    return {r.teacher_id: (r.expected_lessons, r.conducted_lessons, r.missed_lessons) for r in rows}


def _log_dates(db: Session, w, teacher) -> list[date]:
    return [
        r.date
        for r in monitoring_service.teacher_session_log(
            db,
            teacher_id=teacher.id,
            semester_id=w["semester"].id,
            date_from=date(2026, 9, 1),
            date_to=date(2026, 9, 30),
            now=NOW,
        )
    ]


def test_non_working_day_end_cannot_precede_start(db: Session):
    db.add(NonWorkingDay(name="Nooruz", start_date=date(2027, 3, 21), end_date=date(2027, 3, 20)))
    with pytest.raises(IntegrityError):
        db.flush()


def test_rector_creates_lists_updates_and_deletes(db: Session, client_as):
    client = client_as(make_rector(db))
    first = client.post(URL, json={**NOORUZ, "name": "  Nooruz "})
    assert first.status_code == 201
    assert first.json()["name"] == "Nooruz"
    second = client.post(URL, json={"name": "Winter break", "start_date": "2026-12-28", "end_date": "2027-01-08"})
    assert second.status_code == 201

    listed = client.get(URL).json()
    assert [d["name"] for d in listed] == ["Nooruz", "Winter break"]  # newest start first
    assert set(listed[0]) == {"id", "name", "start_date", "end_date"}

    day_id = first.json()["id"]
    updated = client.patch(f"{URL}/{day_id}", json={"end_date": "2027-03-22"})
    assert updated.status_code == 200
    assert updated.json()["end_date"] == "2027-03-22"

    assert client.delete(f"{URL}/{day_id}").status_code == 204
    assert [d["name"] for d in client.get(URL).json()] == ["Winter break"]
    assert client.delete(f"{URL}/{day_id}").status_code == 404
    assert client.patch(f"{URL}/{day_id}", json={"name": "x"}).status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {**NOORUZ, "end_date": "2027-03-20"},
        {**NOORUZ, "name": ""},
        {**NOORUZ, "name": "   "},
        {**NOORUZ, "name": "x" * 256},
        {"start_date": "2027-03-21", "end_date": "2027-03-21"},
    ],
)
def test_invalid_create_is_422(db: Session, client_as, payload):
    assert client_as(make_rector(db)).post(URL, json=payload).status_code == 422


def test_invalid_update_is_422(db: Session, client_as):
    client = client_as(make_rector(db))
    day_id = client.post(URL, json={**NOORUZ, "end_date": "2027-03-22"}).json()["id"]
    assert client.patch(f"{URL}/{day_id}", json={"start_date": "2027-03-23"}).status_code == 422
    assert client.patch(f"{URL}/{day_id}", json={"name": "  "}).status_code == 422
    assert client.patch(f"{URL}/{day_id}", json={"name": None}).status_code == 422


def test_dean_reads_but_cannot_change(db: Session, client_as):
    day_id = client_as(make_rector(db)).post(URL, json=NOORUZ).json()["id"]
    client = client_as(make_dean(db, make_department(db)))
    assert client.get(URL).status_code == 200
    assert client.post(URL, json=NOORUZ).status_code == 403
    assert client.patch(f"{URL}/{day_id}", json={"name": "X"}).status_code == 403
    assert client.delete(f"{URL}/{day_id}").status_code == 403


def test_teacher_has_no_access(db: Session, client_as):
    day_id = client_as(make_rector(db)).post(URL, json=NOORUZ).json()["id"]
    client = client_as(make_teacher(db, make_department(db)).user)
    assert client.get(URL).status_code == 403
    assert client.post(URL, json=NOORUZ).status_code == 403
    assert client.patch(f"{URL}/{day_id}", json={"name": "X"}).status_code == 403
    assert client.delete(f"{URL}/{day_id}").status_code == 403


def test_non_working_day_removes_unopened_lessons_for_every_department(db: Session, client_as):
    w = _world(db)
    a, b = w["teacher_a"], w["teacher_b"]
    assert _counts(db, w) == {a.id: (4, 0, 4), b.id: (4, 0, 4)}  # Mondays 7, 14, 21, 28

    client = client_as(make_rector(db))
    holiday = {"name": "Holiday", "start_date": "2026-09-14", "end_date": "2026-09-14"}
    day_id = client.post(URL, json=holiday).json()["id"]
    assert _counts(db, w) == {a.id: (3, 0, 3), b.id: (3, 0, 3)}
    assert date(2026, 9, 14) not in _log_dates(db, w, a)
    assert date(2026, 9, 14) not in _log_dates(db, w, b)

    # After deleting the day its lessons count again.
    assert client.delete(f"{URL}/{day_id}").status_code == 204
    assert _counts(db, w) == {a.id: (4, 0, 4), b.id: (4, 0, 4)}
    assert date(2026, 9, 14) in _log_dates(db, w, a)


def test_overlapping_and_multi_day_ranges(db: Session):
    w = _world(db)
    a = w["teacher_a"]
    db.add(NonWorkingDay(name="Break", start_date=date(2026, 9, 10), end_date=date(2026, 9, 22)))
    db.add(NonWorkingDay(name="Holiday", start_date=date(2026, 9, 14), end_date=date(2026, 9, 14)))
    db.flush()
    assert _counts(db, w)[a.id] == (2, 0, 2)  # 7 and 28 remain
    assert _log_dates(db, w, a) == [date(2026, 9, 28), date(2026, 9, 7)]


def test_lesson_opened_on_non_working_day_counts_as_conducted(db: Session):
    w = _world(db)
    a = w["teacher_a"]
    session = make_session(db, w["entries"][a.id], MONDAY)
    session.teacher_checked_in_at = bishkek(MONDAY, 8, 5).astimezone(timezone.utc)
    db.add(NonWorkingDay(name="Holiday", start_date=MONDAY, end_date=MONDAY))
    db.flush()
    assert _counts(db, w)[a.id] == (4, 1, 3)
    assert MONDAY in _log_dates(db, w, a)


def test_teacher_can_still_open_a_lesson_on_a_non_working_day(db: Session):
    w = _world(db)
    db.add(NonWorkingDay(name="Holiday", start_date=MONDAY, end_date=MONDAY))
    db.flush()
    session = journal_service.get_or_create_session(
        db, schedule_entry=w["entries"][w["teacher_a"].id], on_date=MONDAY, now=bishkek(MONDAY, 8, 10)
    )
    assert session.id is not None
    assert session.teacher_checked_in_at is not None
