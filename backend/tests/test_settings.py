from datetime import date, timezone

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.app_settings import AppSettings
from app.services import monitoring as monitoring_service
from app.services import settings as settings_service
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

URL = "/api/v1/settings"
MONDAY = date(2026, 9, 7)


def test_settings_table_holds_a_single_row_in_range(db: Session):
    db.add(AppSettings(id=1, late_threshold_minutes=15))
    db.flush()
    db.add(AppSettings(id=2, late_threshold_minutes=15))
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()

    db.add(AppSettings(id=1, late_threshold_minutes=61))
    with pytest.raises(IntegrityError):
        db.flush()


def test_threshold_defaults_to_15_without_a_row(db: Session, client_as):
    assert settings_service.get_late_threshold(db) == 15
    response = client_as(make_rector(db)).get(URL)
    assert response.status_code == 200
    assert response.json() == {"late_threshold_minutes": 15}


def test_rector_changes_threshold_within_0_to_60(db: Session, client_as):
    client = client_as(make_rector(db))
    assert client.patch(URL, json={"late_threshold_minutes": 10}).json() == {"late_threshold_minutes": 10}
    assert client.get(URL).json() == {"late_threshold_minutes": 10}
    assert client.patch(URL, json={"late_threshold_minutes": 0}).status_code == 200
    assert client.patch(URL, json={"late_threshold_minutes": 60}).status_code == 200
    for bad in (-1, 61, "abc", None):
        assert client.patch(URL, json={"late_threshold_minutes": bad}).status_code == 422, bad
    assert client.get(URL).json() == {"late_threshold_minutes": 60}


def test_dean_reads_but_cannot_change_threshold(db: Session, client_as):
    dean = make_dean(db, make_department(db))
    client = client_as(dean)
    assert client.get(URL).status_code == 200
    assert client.patch(URL, json={"late_threshold_minutes": 10}).status_code == 403
    assert settings_service.get_late_threshold(db) == 15


def test_teacher_cannot_read_or_change_threshold(db: Session, client_as):
    teacher = make_teacher(db, make_department(db))
    client = client_as(teacher.user)
    assert client.get(URL).status_code == 403
    assert client.patch(URL, json={"late_threshold_minutes": 10}).status_code == 403


def test_new_threshold_recounts_past_lessons(db: Session, client_as):
    department = make_department(db)
    teacher = make_teacher(db, department)
    semester = make_semester(db)
    assignment = make_assignment(db, teacher, make_subject(db, department), make_group(db, department), semester)
    entry = make_schedule_entry(db, assignment, make_room(db), make_time_slot(db))  # Monday 08:00
    session = make_session(db, entry, MONDAY)
    session.teacher_checked_in_at = bishkek(MONDAY, 8, 12).astimezone(timezone.utc)
    db.flush()

    def counts():
        now = bishkek(MONDAY, 23, 59)
        [row] = monitoring_service.teacher_monitoring(
            db, semester_id=semester.id, date_from=MONDAY, date_to=MONDAY, now=now
        )
        [log_row] = monitoring_service.teacher_session_log(
            db, teacher_id=teacher.id, semester_id=semester.id, date_from=MONDAY, date_to=MONDAY, now=now
        )
        return row.late_lessons, log_row.late

    assert counts() == (0, False)  # 12 minutes is within the default 15
    assert client_as(make_rector(db)).patch(URL, json={"late_threshold_minutes": 10}).status_code == 200
    assert counts() == (1, True)
