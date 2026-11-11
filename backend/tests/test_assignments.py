from sqlalchemy.orm import Session

from app.models.assignment import TeachingAssignment
from app.models.enums import GroupType, HourType, UserRole
from app.models.schedule import ScheduleEntry
from tests.factories import (
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

URL = "/api/v1/assignments"


def _world(db: Session):
    """Two departments, each with a teacher, subject and group; one semester."""
    dep_a = make_department(db, "A")
    dep_b = make_department(db, "B")
    teacher_a = make_teacher(db, dep_a, "teacher_a")
    teacher_a2 = make_teacher(db, dep_a, "teacher_a2")
    teacher_b = make_teacher(db, dep_b, "teacher_b")
    subject_a = make_subject(db, dep_a, "A101")
    subject_a2 = make_subject(db, dep_a, "A102")
    subject_b = make_subject(db, dep_b, "B101")
    group_a = make_group(db, dep_a, "GA")
    group_a2 = make_group(db, dep_a, "GA2")
    group_b = make_group(db, dep_b, "GB")
    semester = make_semester(db, "2026 Fall")
    return {
        "dep_a": dep_a, "dep_b": dep_b,
        "teacher_a": teacher_a, "teacher_a2": teacher_a2, "teacher_b": teacher_b,
        "subject_a": subject_a, "subject_a2": subject_a2, "subject_b": subject_b,
        "group_a": group_a, "group_a2": group_a2, "group_b": group_b,
        "semester": semester,
    }


def _snapshot(assignment: TeachingAssignment) -> tuple:
    return (assignment.teacher_id, assignment.subject_id, assignment.group_id, assignment.semester_id, assignment.hour_type)


# --- GET: a teacher sees only their own assignments (criterion 5) ---


def test_teacher_lists_only_own_assignments(db: Session, client_as):
    w = _world(db)
    other_semester = make_semester(db, "2027 Spring")
    own = make_assignment(db, w["teacher_a"], w["subject_a"], w["group_a"], w["semester"])
    own_other_semester = make_assignment(db, w["teacher_a"], w["subject_a"], w["group_a"], other_semester)
    make_assignment(db, w["teacher_a2"], w["subject_a"], w["group_a"], w["semester"])
    make_assignment(db, w["teacher_b"], w["subject_b"], w["group_b"], w["semester"])

    client = client_as(w["teacher_a"].user)
    all_ids = {a["id"] for a in client.get(URL).json()}
    assert all_ids == {own.id, own_other_semester.id}

    in_semester = client.get(URL, params={"semester_id": w["semester"].id}).json()
    assert [a["id"] for a in in_semester] == [own.id]


def test_teacher_without_profile_gets_empty_list(db: Session, client_as):
    w = _world(db)
    make_assignment(db, w["teacher_a"], w["subject_a"], w["group_a"], w["semester"])
    bare = make_user(db, "no_profile", UserRole.TEACHER)

    response = client_as(bare).get(URL)
    assert response.status_code == 200
    assert response.json() == []


# --- Teachers can't write (criteria 6, 31) ---


def test_teacher_cannot_create_update_delete_assignment(db: Session, client_as):
    w = _world(db)
    hafiz_group = make_group(db, w["dep_a"], "HAFIZ-1", group_type=GroupType.HAFIZ)
    hafiz_teacher = make_teacher(db, w["dep_a"], "hafiz_teacher")
    hafiz_assignment = make_assignment(db, hafiz_teacher, w["subject_a"], hafiz_group, w["semester"])
    own = make_assignment(db, w["teacher_a"], w["subject_a"], w["group_a"], w["semester"])

    for teacher, assignment in ((w["teacher_a"], own), (hafiz_teacher, hafiz_assignment)):
        client = client_as(teacher.user)
        create = client.post(
            URL,
            json={
                "teacher_id": teacher.id, "subject_id": w["subject_a2"].id, "group_id": w["group_a"].id,
                "semester_id": w["semester"].id, "hour_type": "PRACTICE",
            },
        )
        assert create.status_code == 403
        assert client.patch(f"{URL}/{assignment.id}", json={"hour_type": "LAB"}).status_code == 403
        assert client.delete(f"{URL}/{assignment.id}").status_code == 403

    assert db.get(TeachingAssignment, own.id).hour_type == HourType.LECTURE


# --- PATCH by rector and dean (criteria 27, 30) ---


def test_rector_updates_all_fields_of_unscheduled_assignment(db: Session, client_as):
    w = _world(db)
    other_semester = make_semester(db, "2027 Spring")
    assignment = make_assignment(db, w["teacher_a"], w["subject_a"], w["group_a"], w["semester"])

    response = client_as(make_rector(db)).patch(
        f"{URL}/{assignment.id}",
        json={
            "teacher_id": w["teacher_b"].id, "subject_id": w["subject_b"].id, "group_id": w["group_b"].id,
            "semester_id": other_semester.id, "hour_type": "LAB",
        },
    )

    assert response.status_code == 200, response.text
    db.refresh(assignment)
    assert _snapshot(assignment) == (
        w["teacher_b"].id, w["subject_b"].id, w["group_b"].id, other_semester.id, HourType.LAB
    )


def test_dean_updates_own_department_assignment(db: Session, client_as):
    w = _world(db)
    dean = make_dean(db, w["dep_a"])
    assignment = make_assignment(db, w["teacher_a"], w["subject_a"], w["group_a"], w["semester"])

    response = client_as(dean).patch(
        f"{URL}/{assignment.id}",
        json={"teacher_id": w["teacher_a2"].id, "subject_id": w["subject_a2"].id, "group_id": w["group_a2"].id},
    )

    assert response.status_code == 200, response.text
    assert response.json()["subject_id"] == w["subject_a2"].id
    db.refresh(assignment)
    assert (assignment.teacher_id, assignment.group_id) == (w["teacher_a2"].id, w["group_a2"].id)


def test_dean_cannot_update_other_department_assignment(db: Session, client_as):
    w = _world(db)
    dean = make_dean(db, w["dep_a"])
    foreign = make_assignment(db, w["teacher_b"], w["subject_b"], w["group_b"], w["semester"])
    before = _snapshot(foreign)

    response = client_as(dean).patch(f"{URL}/{foreign.id}", json={"hour_type": "LAB"})

    assert response.status_code == 403
    db.refresh(foreign)
    assert _snapshot(foreign) == before


def test_dean_cannot_move_assignment_to_other_department_teacher_subject_or_group(db: Session, client_as):
    w = _world(db)
    dean = make_dean(db, w["dep_a"])
    assignment = make_assignment(db, w["teacher_a"], w["subject_a"], w["group_a"], w["semester"])
    before = _snapshot(assignment)
    client = client_as(dean)

    for change in (
        {"teacher_id": w["teacher_b"].id},
        {"subject_id": w["subject_b"].id},
        {"group_id": w["group_b"].id},
    ):
        response = client.patch(f"{URL}/{assignment.id}", json=change)
        assert response.status_code == 403, change
        assert response.json()["detail"] == "You do not have access to this department"

    db.refresh(assignment)
    assert _snapshot(assignment) == before


# --- Assignment already in the timetable (criterion 28) ---


def _scheduled(db: Session, w):
    assignment = make_assignment(db, w["teacher_a"], w["subject_a"], w["group_a"], w["semester"])
    entry = make_schedule_entry(db, assignment, make_room(db), make_time_slot(db))
    return assignment, entry


def test_scheduled_assignment_subject_and_hour_type_can_change(db: Session, client_as):
    w = _world(db)
    assignment, entry = _scheduled(db, w)

    response = client_as(make_rector(db)).patch(
        f"{URL}/{assignment.id}", json={"subject_id": w["subject_a2"].id, "hour_type": "PRACTICE"}
    )

    assert response.status_code == 200, response.text
    same_entry = db.get(ScheduleEntry, entry.id)
    db.refresh(same_entry)
    assert same_entry.assignment_id == assignment.id
    assert same_entry.assignment.subject_id == w["subject_a2"].id
    assert same_entry.assignment.hour_type == HourType.PRACTICE


def test_scheduled_assignment_group_change_is_409(db: Session, client_as):
    w = _world(db)
    assignment, entry = _scheduled(db, w)
    before = _snapshot(assignment)

    response = client_as(make_rector(db)).patch(f"{URL}/{assignment.id}", json={"group_id": w["group_a2"].id})

    assert response.status_code == 409
    assert response.json()["detail"] == "Cannot change the group or semester of an assignment that is in the timetable"
    db.refresh(assignment)
    db.refresh(entry)
    assert _snapshot(assignment) == before
    assert entry.group_id == w["group_a"].id


def test_scheduled_assignment_semester_change_is_409(db: Session, client_as):
    w = _world(db)
    other_semester = make_semester(db, "2027 Spring")
    assignment, _ = _scheduled(db, w)
    before = _snapshot(assignment)

    response = client_as(make_rector(db)).patch(f"{URL}/{assignment.id}", json={"semester_id": other_semester.id})

    assert response.status_code == 409
    assert response.json()["detail"] == "Cannot change the group or semester of an assignment that is in the timetable"
    db.refresh(assignment)
    assert _snapshot(assignment) == before


# --- Duplicates and missing objects (criterion 29) ---


def test_update_to_duplicate_is_409(db: Session, client_as):
    w = _world(db)
    make_assignment(db, w["teacher_a"], w["subject_a"], w["group_a"], w["semester"], HourType.LECTURE)
    other = make_assignment(db, w["teacher_a"], w["subject_a"], w["group_a"], w["semester"], HourType.PRACTICE)

    response = client_as(make_rector(db)).patch(f"{URL}/{other.id}", json={"hour_type": "LECTURE"})

    assert response.status_code == 409
    assert response.json()["detail"] == "This teacher is already assigned to this subject/group/semester/hour type"
    db.refresh(other)
    assert other.hour_type == HourType.PRACTICE


def test_update_with_nulls_and_unchanged_values_keeps_assignment(db: Session, client_as):
    w = _world(db)
    assignment = make_assignment(db, w["teacher_a"], w["subject_a"], w["group_a"], w["semester"])
    before = _snapshot(assignment)

    response = client_as(make_rector(db)).patch(
        f"{URL}/{assignment.id}", json={"teacher_id": None, "subject_id": w["subject_a"].id}
    )

    assert response.status_code == 200
    db.refresh(assignment)
    assert _snapshot(assignment) == before


def test_update_missing_assignment_is_404(db: Session, client_as):
    _world(db)
    response = client_as(make_rector(db)).patch(f"{URL}/9999", json={"hour_type": "LAB"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Assignment not found"


def test_update_to_missing_teacher_is_404(db: Session, client_as):
    w = _world(db)
    assignment = make_assignment(db, w["teacher_a"], w["subject_a"], w["group_a"], w["semester"])
    response = client_as(make_rector(db)).patch(f"{URL}/{assignment.id}", json={"teacher_id": 9999})
    assert response.status_code == 404
    assert response.json()["detail"] == "Teacher not found"


# --- Create and delete unchanged (criterion 32) ---


def test_create_and_delete_still_work(db: Session, client_as):
    w = _world(db)
    client = client_as(make_rector(db))
    payload = {
        "teacher_id": w["teacher_a"].id, "subject_id": w["subject_a"].id, "group_id": w["group_a"].id,
        "semester_id": w["semester"].id, "hour_type": "LECTURE",
    }

    created = client.post(URL, json=payload)
    assert created.status_code == 201
    assert client.post(URL, json=payload).status_code == 409

    assignment_id = created.json()["id"]
    assert client.delete(f"{URL}/{assignment_id}").status_code == 204
    assert db.get(TeachingAssignment, assignment_id) is None
