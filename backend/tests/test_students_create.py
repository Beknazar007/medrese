from sqlalchemy.orm import Session

from tests.factories import make_department, make_group, make_rector

URL = "/api/v1/students"


def test_create_student_with_null_or_missing_is_active_is_active(db: Session, client_as):
    group = make_group(db, make_department(db))
    client = client_as(make_rector(db))

    null = client.post(URL, json={"full_name": "Null Switch", "group_id": group.id, "is_active": None})
    missing = client.post(URL, json={"full_name": "No Switch", "group_id": group.id})
    inactive = client.post(URL, json={"full_name": "Off", "group_id": group.id, "is_active": False})

    assert null.status_code == 201, null.text
    assert null.json()["is_active"] is True
    assert missing.json()["is_active"] is True
    assert inactive.json()["is_active"] is False
