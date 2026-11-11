from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.journal import _assert_can_access_entry
from app.models.assignment_teacher_change import AssignmentTeacherChange
from app.models.enums import DayOfWeek
from app.models.schedule import ScheduleEntry
from app.services import assignments as assignment_service
from app.services import journal as journal_service
from app.services import monitoring as monitoring_service
from tests.factories import (
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
)

BISHKEK_TZ = ZoneInfo("Asia/Bishkek")
URL = "/api/v1/assignments"


def _world(db: Session):
    dep = make_department(db, "A")
    other_dep = make_department(db, "B")
    old = make_teacher(db, dep, "old_teacher")
    new = make_teacher(db, dep, "new_teacher")
    foreign = make_teacher(db, other_dep, "foreign_teacher")
    subject = make_subject(db, dep, "A101")
    group = make_group(db, dep, "GA")
    other_group = make_group(db, dep, "GA2")
    semester = make_semester(db)  # 2026-09-01 .. 2026-12-31
    slot1 = make_time_slot(db, 1)
    slot2 = make_time_slot(db, 2)
    room1 = make_room(db, "101")
    room2 = make_room(db, "102")
    assignment = make_assignment(db, old, subject, group, semester)
    monday = make_schedule_entry(db, assignment, room1, slot1, DayOfWeek.MONDAY)
    tuesday = make_schedule_entry(db, assignment, room1, slot2, DayOfWeek.TUESDAY)
    return {
        "dep": dep, "old": old, "new": new, "foreign": foreign, "subject": subject, "group": group,
        "other_group": other_group, "semester": semester, "slot1": slot1, "slot2": slot2,
        "room2": room2, "assignment": assignment, "monday": monday, "tuesday": tuesday,
    }


def _changes(db: Session, assignment_id: int) -> list[AssignmentTeacherChange]:
    return list(
        db.scalars(select(AssignmentTeacherChange).where(AssignmentTeacherChange.assignment_id == assignment_id))
    )


# --- B5.R1: the new teacher takes every timetable lesson ---


def test_rector_replaces_teacher_in_all_schedule_entries(db: Session, client_as):
    w = _world(db)
    rector = make_rector(db)

    response = client_as(rector).patch(f"{URL}/{w['assignment'].id}", json={"teacher_id": w["new"].id})

    assert response.status_code == 200, response.text
    entries = db.scalars(select(ScheduleEntry).where(ScheduleEntry.assignment_id == w["assignment"].id)).all()
    assert len(entries) == 2
    assert {e.teacher_id for e in entries} == {w["new"].id}
    [change] = _changes(db, w["assignment"].id)
    assert (change.from_teacher_id, change.to_teacher_id) == (w["old"].id, w["new"].id)
    assert change.effective_from == assignment_service.today_bishkek()
    assert change.changed_by_user_id == rector.id


# --- B5.R2: clashes are reported and nothing changes ---


def _book_new_teacher(db: Session, w, day: DayOfWeek, slot):
    busy = make_assignment(db, w["new"], w["subject"], w["other_group"], w["semester"])
    return make_schedule_entry(db, busy, w["room2"], slot, day)


def test_replacement_conflict_is_409_and_changes_nothing(db: Session, client_as):
    w = _world(db)
    _book_new_teacher(db, w, DayOfWeek.MONDAY, w["slot1"])

    response = client_as(make_rector(db)).patch(f"{URL}/{w['assignment'].id}", json={"teacher_id": w["new"].id})

    assert response.status_code == 409
    assert response.json()["detail"] == "The new teacher already has classes at: 1/1"
    db.refresh(w["assignment"])
    db.refresh(w["monday"])
    db.refresh(w["tuesday"])
    assert w["assignment"].teacher_id == w["old"].id
    assert w["monday"].teacher_id == w["old"].id
    assert w["tuesday"].teacher_id == w["old"].id
    assert _changes(db, w["assignment"].id) == []


def test_replacement_lists_every_conflicting_slot(db: Session, client_as):
    w = _world(db)
    busy = make_assignment(db, w["new"], w["subject"], w["other_group"], w["semester"])
    make_schedule_entry(db, busy, w["room2"], w["slot1"], DayOfWeek.MONDAY)
    make_schedule_entry(db, busy, w["room2"], w["slot2"], DayOfWeek.TUESDAY)

    response = client_as(make_rector(db)).patch(f"{URL}/{w['assignment'].id}", json={"teacher_id": w["new"].id})

    assert response.status_code == 409
    assert response.json()["detail"] == "The new teacher already has classes at: 1/1, 2/2"


def test_replacement_race_on_booked_slot_is_409_and_changes_nothing(db: Session, client_as, monkeypatch):
    """The clash check passed, but the slot was taken before the UPDATE: the unique constraint
    on the timetable must turn into a clear 409, not a 500."""
    w = _world(db)
    _book_new_teacher(db, w, DayOfWeek.MONDAY, w["slot1"])
    monkeypatch.setattr(assignment_service, "find_teacher_conflicts", lambda *args, **kwargs: [])

    response = client_as(make_rector(db)).patch(f"{URL}/{w['assignment'].id}", json={"teacher_id": w["new"].id})

    assert response.status_code == 409
    assert response.json()["detail"] == "This slot is already booked"
    for obj in (w["assignment"], w["monday"], w["tuesday"]):
        db.refresh(obj)
    assert w["assignment"].teacher_id == w["old"].id
    assert w["monday"].teacher_id == w["old"].id
    assert w["tuesday"].teacher_id == w["old"].id
    assert _changes(db, w["assignment"].id) == []


# --- B5.R6: the new teacher stays in the assignment's department ---


def test_dean_replaces_teacher_within_own_department(db: Session, client_as):
    w = _world(db)
    dean = make_dean(db, w["dep"])

    response = client_as(dean).patch(f"{URL}/{w['assignment'].id}", json={"teacher_id": w["new"].id})

    assert response.status_code == 200, response.text
    db.refresh(w["monday"])
    assert w["monday"].teacher_id == w["new"].id


def test_dean_cannot_replace_with_other_department_teacher(db: Session, client_as):
    w = _world(db)
    dean = make_dean(db, w["dep"])

    response = client_as(dean).patch(f"{URL}/{w['assignment'].id}", json={"teacher_id": w["foreign"].id})

    assert response.status_code == 403
    db.refresh(w["monday"])
    assert w["monday"].teacher_id == w["old"].id


def test_rector_cannot_replace_with_other_department_teacher_on_scheduled_assignment(db: Session, client_as):
    w = _world(db)

    response = client_as(make_rector(db)).patch(
        f"{URL}/{w['assignment'].id}", json={"teacher_id": w["foreign"].id}
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "The new teacher must be from the same department as the assignment"
    db.refresh(w["assignment"])
    assert w["assignment"].teacher_id == w["old"].id
    assert _changes(db, w["assignment"].id) == []


# --- B5.R3: history stays with whoever held the lesson ---


def test_held_sessions_keep_previous_teacher(db: Session):
    w = _world(db)
    student = make_student(db, w["group"])
    held = make_session(db, w["monday"], date(2026, 9, 7))

    assignment_service.replace_teacher(
        db, assignment=w["assignment"], new_teacher_id=w["new"].id, changed_by_user_id=None,
        effective_from=date(2026, 9, 10),
    )
    w["assignment"].teacher_id = w["new"].id
    db.flush()

    db.refresh(held)
    assert held.teacher_id == w["old"].id

    [row] = journal_service.student_history(db, student_id=student.id, group_id=w["group"].id)
    assert (row.teacher_id, row.teacher_name) == (w["old"].id, "old_teacher")
    by_old = journal_service.student_history(db, student_id=student.id, group_id=w["group"].id, teacher_id=w["old"].id)
    assert [r.session_id for r in by_old] == [held.id]
    assert journal_service.student_history(
        db, student_id=student.id, group_id=w["group"].id, teacher_id=w["new"].id
    ) == []


def test_monitoring_attributes_past_lessons_to_previous_teacher(db: Session):
    w = _world(db)
    # Only Mondays matter here: drop the Tuesday entry.
    db.delete(w["tuesday"])
    db.flush()

    # Mondays in September 2026: 7, 14, 21, 28. Old teacher holds the 7th and misses the 14th;
    # the replacement takes effect on the 21st; the new teacher misses the 21st, holds the 28th.
    make_session(db, w["monday"], date(2026, 9, 7))
    assignment_service.replace_teacher(
        db, assignment=w["assignment"], new_teacher_id=w["new"].id, changed_by_user_id=None,
        effective_from=date(2026, 9, 21),
    )
    w["assignment"].teacher_id = w["new"].id
    db.flush()
    db.refresh(w["monday"])
    make_session(db, w["monday"], date(2026, 9, 28))

    rows = {
        r.teacher_id: r
        for r in monitoring_service.teacher_monitoring(
            db, semester_id=w["semester"].id, date_from=date(2026, 9, 1), date_to=date(2026, 9, 30),
            today=date(2026, 9, 30),
        )
    }
    assert set(rows) == {w["old"].id, w["new"].id}
    old_row, new_row = rows[w["old"].id], rows[w["new"].id]
    assert (old_row.expected_lessons, old_row.conducted_lessons, old_row.missed_lessons) == (2, 1, 1)
    assert (new_row.expected_lessons, new_row.conducted_lessons, new_row.missed_lessons) == (2, 1, 1)

    def log(teacher_id):
        return [
            (r.date, r.conducted)
            for r in monitoring_service.teacher_session_log(
                db, teacher_id=teacher_id, semester_id=w["semester"].id, date_from=date(2026, 9, 1),
                date_to=date(2026, 9, 30), today=date(2026, 9, 30),
            )
        ]

    assert log(w["old"].id) == [(date(2026, 9, 14), False), (date(2026, 9, 7), True)]
    assert log(w["new"].id) == [(date(2026, 9, 28), True), (date(2026, 9, 21), False)]


# --- B5.R4: the new teacher runs the lessons, the old one no longer does ---


def test_new_teacher_sees_entries_and_can_open_journal_old_cannot(db: Session, client_as):
    w = _world(db)
    assert client_as(make_rector(db)).patch(
        f"{URL}/{w['assignment'].id}", json={"teacher_id": w["new"].id}
    ).status_code == 200

    new_schedule = {e["id"] for e in client_as(w["new"].user).get("/api/v1/schedule").json()}
    old_schedule = {e["id"] for e in client_as(w["old"].user).get("/api/v1/schedule").json()}
    assert new_schedule == {w["monday"].id, w["tuesday"].id}
    assert old_schedule == set()

    entry = db.get(ScheduleEntry, w["monday"].id)
    _assert_can_access_entry(db, w["new"].user, entry)
    with pytest.raises(HTTPException) as exc:
        _assert_can_access_entry(db, w["old"].user, entry)
    assert exc.value.status_code == 403


def test_new_session_is_stamped_with_entry_teacher(db: Session):
    w = _world(db)
    session = journal_service.get_or_create_session(
        db, schedule_entry=w["monday"], on_date=date(2026, 9, 7), today=date(2026, 9, 7),
        now=datetime(2026, 9, 7, 8, 30, tzinfo=BISHKEK_TZ),
    )
    assert session.teacher_id == w["old"].id


def test_unscheduled_teacher_change_writes_no_history(db: Session, client_as):
    w = _world(db)
    unscheduled = make_assignment(db, w["old"], w["subject"], w["other_group"], w["semester"])

    response = client_as(make_rector(db)).patch(f"{URL}/{unscheduled.id}", json={"teacher_id": w["new"].id})

    assert response.status_code == 200
    assert _changes(db, unscheduled.id) == []


def test_deleting_assignment_removes_its_replacement_log(db: Session):
    w = _world(db)
    assignment_service.replace_teacher(
        db, assignment=w["assignment"], new_teacher_id=w["new"].id, changed_by_user_id=None
    )
    db.flush()
    db.delete(w["monday"])
    db.delete(w["tuesday"])
    db.flush()
    db.expire(w["assignment"])

    db.delete(w["assignment"])
    db.flush()

    assert db.scalars(select(AssignmentTeacherChange)).all() == []
