from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.semesters import _deactivate_other_semesters
from app.models.semester import Semester
from tests.factories import make_dean, make_department, make_rector, make_teacher

URL = "/api/v1/semesters"


def _make_semester(db: Session, name: str, is_active: bool) -> Semester:
    semester = Semester(name=name, start_date=date(2026, 1, 1), end_date=date(2026, 6, 1), is_active=is_active)
    db.add(semester)
    db.flush()
    return semester


def test_activating_a_semester_deactivates_the_others(db: Session):
    old_active = _make_semester(db, "2026 Spring", is_active=True)
    new_active = _make_semester(db, "2026 Fall", is_active=True)  # simulates the row just flipped to active

    _deactivate_other_semesters(db, keep_id=new_active.id)
    db.flush()

    assert db.get(Semester, old_active.id).is_active is False
    assert db.get(Semester, new_active.id).is_active is True


def test_deactivate_others_leaves_a_single_active_semester_among_many(db: Session):
    a = _make_semester(db, "A", is_active=True)
    b = _make_semester(db, "B", is_active=True)
    c = _make_semester(db, "C", is_active=False)

    _deactivate_other_semesters(db, keep_id=b.id)
    db.flush()

    active = db.scalars(select(Semester).where(Semester.is_active.is_(True))).all()
    assert [s.id for s in active] == [b.id]
    assert db.get(Semester, a.id).is_active is False
    assert db.get(Semester, c.id).is_active is False


# --- HTTP: the "active" switch left untouched (B4, criteria 19, 20, 23) ---


def test_create_semester_without_or_with_null_is_active_is_inactive_and_keeps_current_active(db: Session, client_as):
    current = _make_semester(db, "Current", is_active=True)
    client = client_as(make_rector(db))
    dates = {"start_date": "2027-01-10", "end_date": "2027-06-01"}

    missing = client.post(URL, json={"name": "No switch", **dates})
    null = client.post(URL, json={"name": "Null switch", "is_active": None, **dates})

    assert missing.status_code == 201, missing.text
    assert null.status_code == 201, null.text
    assert missing.json()["is_active"] is False
    assert null.json()["is_active"] is False
    db.refresh(current)
    assert current.is_active is True


def test_create_active_semester_deactivates_others(db: Session, client_as):
    current = _make_semester(db, "Current", is_active=True)
    client = client_as(make_rector(db))

    response = client.post(
        URL, json={"name": "Next", "start_date": "2027-01-10", "end_date": "2027-06-01", "is_active": True}
    )

    assert response.status_code == 201
    assert response.json()["is_active"] is True
    db.refresh(current)
    assert current.is_active is False


def test_dean_and_teacher_get_403_on_semester_writes(db: Session, client_as):
    semester = _make_semester(db, "Current", is_active=True)
    department = make_department(db)
    dean = make_dean(db, department)
    teacher = make_teacher(db, department)
    payload = {"name": "X", "start_date": "2027-01-10", "end_date": "2027-06-01"}

    for user in (dean, teacher.user):
        client = client_as(user)
        assert client.post(URL, json=payload).status_code == 403
        assert client.patch(f"{URL}/{semester.id}", json={"name": "Y"}).status_code == 403
        assert client.delete(f"{URL}/{semester.id}").status_code == 403

    db.refresh(semester)
    assert semester.name == "Current"
