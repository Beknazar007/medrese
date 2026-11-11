from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import GroupType, UserRole
from tests.factories import (
    make_assignment,
    make_dean,
    make_department,
    make_group,
    make_rector,
    make_semester,
    make_subject,
    make_teacher,
    make_user,
)

ME = "/api/v1/auth/me"
ME_KEYS = {
    "id",
    "username",
    "email",
    "role",
    "is_active",
    "must_change_password",
    "headed_department_id",
    "full_name",
}


def test_me_teacher_with_profile_returns_full_name(db: Session, client_as):
    department = make_department(db)
    teacher = make_teacher(db, department)
    teacher.full_name = "Асанов Бакыт Маратович"

    response = client_as(teacher.user).get(ME)

    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Асанов Бакыт Маратович"
    assert body["username"] == "teacher1"
    assert body["role"] == "TEACHER"


def test_me_hafiz_teacher_returns_full_name(db: Session, client_as):
    department = make_department(db)
    teacher = make_teacher(db, department, username="hafiz1")
    teacher.full_name = "Мамытов Азамат"
    group = make_group(db, department, "HAFIZ-1", group_type=GroupType.HAFIZ)
    make_assignment(db, teacher, make_subject(db, department), group, make_semester(db))

    response = client_as(teacher.user).get(ME)

    assert response.status_code == 200
    assert response.json()["full_name"] == "Мамытов Азамат"


def test_me_teacher_without_profile_full_name_null(db: Session, client_as):
    user = make_user(db, "bare_teacher", UserRole.TEACHER)

    response = client_as(user).get(ME)

    assert response.status_code == 200
    assert response.json()["full_name"] is None


def test_me_rector_full_name_null_other_fields_unchanged(db: Session, client_as):
    rector = make_rector(db)

    response = client_as(rector).get(ME)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == ME_KEYS
    assert body["full_name"] is None
    assert body["headed_department_id"] is None
    assert body["username"] == "rector"
    assert body["role"] == "RECTOR"


def test_me_dean_full_name_null_keeps_headed_department(db: Session, client_as):
    department = make_department(db)
    dean = make_dean(db, department)

    response = client_as(dean).get(ME)

    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] is None
    assert body["headed_department_id"] == department.id


def test_me_returns_only_own_name(db: Session, client_as):
    department = make_department(db)
    teacher_a = make_teacher(db, department, username="teacher_a")
    teacher_a.full_name = "Teacher Alpha"
    teacher_b = make_teacher(db, department, username="teacher_b")
    teacher_b.full_name = "Teacher Bravo"

    response = client_as(teacher_a.user).get(ME)

    assert response.status_code == 200
    assert response.json()["full_name"] == "Teacher Alpha"
    assert "Teacher Bravo" not in response.text


def test_me_reflects_renamed_teacher(db: Session, client_as):
    department = make_department(db)
    rector = make_rector(db)
    teacher = make_teacher(db, department)

    patched = client_as(rector).patch(f"/api/v1/teachers/{teacher.id}", json={"full_name": "Жаңы Аты"})
    assert patched.status_code == 200

    response = client_as(teacher.user).get(ME)
    assert response.json()["full_name"] == "Жаңы Аты"


def test_me_without_token_401(db: Session):
    from app.db.session import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        assert client.get(ME).status_code == 401
        assert client.get(ME, headers={"Authorization": "Bearer garbage"}).status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_users_list_has_no_full_name_and_is_rector_only(db: Session, client_as):
    department = make_department(db)
    rector = make_rector(db)
    dean = make_dean(db, department)
    teacher = make_teacher(db, department)

    response = client_as(rector).get("/api/v1/users")
    assert response.status_code == 200
    assert response.json()
    assert all("full_name" not in row for row in response.json())

    assert client_as(dean).get("/api/v1/users").status_code == 403
    assert client_as(teacher.user).get("/api/v1/users").status_code == 403
