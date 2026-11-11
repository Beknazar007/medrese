from sqlalchemy.orm import Session

from app.models.subject import Subject
from tests.factories import make_department, make_rector, make_subject

URL = "/api/v1/subjects"


def test_create_subject_with_null_or_missing_hours_defaults_to_zero(db: Session, client_as):
    department = make_department(db)
    client = client_as(make_rector(db))

    only_lecture = client.post(
        URL,
        json={"name": "Fiqh", "code": "F1", "department_id": department.id, "lecture_hours": 36,
              "practice_hours": None, "lab_hours": None},
    )
    assert only_lecture.status_code == 201, only_lecture.text
    body = only_lecture.json()
    assert (body["lecture_hours"], body["practice_hours"], body["lab_hours"]) == (36, 0, 0)

    no_hours = client.post(URL, json={"name": "Aqida", "code": "A1", "department_id": department.id})
    assert no_hours.status_code == 201
    all_null = client.post(
        URL,
        json={"name": "Tafsir", "code": "T1", "department_id": department.id,
              "lecture_hours": None, "practice_hours": None, "lab_hours": None},
    )
    assert all_null.status_code == 201
    for body in (no_hours.json(), all_null.json()):
        assert (body["lecture_hours"], body["practice_hours"], body["lab_hours"]) == (0, 0, 0)


def test_patch_subject_null_practice_hours_sets_zero(db: Session, client_as):
    department = make_department(db)
    subject = make_subject(db, department)
    subject.practice_hours = 12
    client = client_as(make_rector(db))

    response = client.patch(f"{URL}/{subject.id}", json={"practice_hours": None})

    assert response.status_code == 200, response.text
    assert response.json()["practice_hours"] == 0
    db.refresh(subject)
    assert subject.practice_hours == 0
    assert subject.lecture_hours == 30  # untouched fields stay


def test_negative_or_fractional_hours_rejected(db: Session, client_as):
    department = make_department(db)
    subject = make_subject(db, department)
    client = client_as(make_rector(db))

    negative = client.post(URL, json={"name": "X", "code": "X1", "department_id": department.id, "lab_hours": -1})
    assert negative.status_code == 422
    assert negative.json()["detail"][0]["type"] == "greater_than_equal"
    fractional = client.post(URL, json={"name": "X", "code": "X1", "department_id": department.id, "lab_hours": 1.5})
    assert fractional.status_code == 422
    assert client.patch(f"{URL}/{subject.id}", json={"practice_hours": -3}).status_code == 422


def test_patch_subject_null_name_is_ignored(db: Session, client_as):
    department = make_department(db)
    subject = make_subject(db, department)
    client = client_as(make_rector(db))

    response = client.patch(f"{URL}/{subject.id}", json={"name": None, "lecture_hours": 40})

    assert response.status_code == 200
    stored = db.get(Subject, subject.id)
    db.refresh(stored)
    assert (stored.name, stored.lecture_hours) == ("Mathematics", 40)
