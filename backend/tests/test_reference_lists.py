from sqlalchemy.orm import Session

from tests.factories import (
    make_assignment,
    make_dean,
    make_department,
    make_group,
    make_rector,
    make_semester,
    make_subject,
    make_teacher,
)


def _world(db: Session):
    dep_a = make_department(db, "A")
    dep_b = make_department(db, "B")
    teacher = make_teacher(db, dep_a, "teacher_a")
    other_teacher = make_teacher(db, dep_b, "teacher_b")
    subject_a = make_subject(db, dep_a, "A101")
    subject_b_assigned = make_subject(db, dep_b, "B101")
    subject_b_other = make_subject(db, dep_b, "B102")
    group_a = make_group(db, dep_a, "GA")
    group_b_assigned = make_group(db, dep_b, "GB1")
    group_b_other = make_group(db, dep_b, "GB2")
    semester = make_semester(db)
    # The rector gave the department-A teacher a department-B subject and group (criterion 4).
    make_assignment(db, teacher, subject_b_assigned, group_b_assigned, semester)
    # An assignment of another teacher in department B must not leak to this teacher.
    make_assignment(db, other_teacher, subject_b_other, group_b_other, semester)
    return dep_a, teacher, subject_a, subject_b_assigned, group_a, group_b_assigned


def _ids(response) -> set[int]:
    assert response.status_code == 200
    return {row["id"] for row in response.json()}


def test_teacher_sees_other_department_subject_and_group_of_own_assignment_only(db: Session, client_as):
    _, teacher, subject_a, subject_b_assigned, group_a, group_b_assigned = _world(db)
    client = client_as(teacher.user)

    assert _ids(client.get("/api/v1/subjects")) == {subject_a.id, subject_b_assigned.id}
    assert _ids(client.get("/api/v1/groups")) == {group_a.id, group_b_assigned.id}


def test_rector_and_dean_lists_unchanged(db: Session, client_as):
    dep_a, _, subject_a, _, group_a, _ = _world(db)

    rector = client_as(make_rector(db))
    assert len(_ids(rector.get("/api/v1/subjects"))) == 3
    assert len(_ids(rector.get("/api/v1/groups"))) == 3

    dean = client_as(make_dean(db, dep_a))
    assert _ids(dean.get("/api/v1/subjects")) == {subject_a.id}
    assert _ids(dean.get("/api/v1/groups")) == {group_a.id}
