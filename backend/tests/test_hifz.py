from datetime import date

import pytest
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models.enums import GroupType, HifzKind
from app.schemas.hifz import HifzRecordUpsert, HifzTargetCreate
from app.services import hifz as hifz_service
from tests.factories import (
    make_assignment,
    make_department,
    make_group,
    make_student,
    make_subject,
    make_teacher,
)


def _setup_hafiz(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    subject = make_subject(db, department)
    group = make_group(db, department, group_type=GroupType.HAFIZ)
    student = make_student(db, group, full_name="Aisha")
    return department, teacher, subject, group, student


def test_upsert_records_keeps_hifz_and_repeat_independent_for_same_day(db: Session):
    _, _, _, group, student = _setup_hafiz(db)
    on_date = date(2026, 9, 7)

    hifz_service.upsert_records(
        db,
        group_id=group.id,
        on_date=on_date,
        records=[
            HifzRecordUpsert(student_id=student.id, kind=HifzKind.HIFZ, score=80, juz=5, page_from=91, page_to=95),
            HifzRecordUpsert(student_id=student.id, kind=HifzKind.REPEAT, score=90, juz=3, page_from=41, page_to=45),
        ],
    )
    db.flush()

    roster = hifz_service.roster_for_group_date(db, group_id=group.id, on_date=on_date)
    assert len(roster) == 1
    row = roster[0]
    assert row.hifz.score == 80
    assert row.hifz.juz == 5
    assert row.repeat.score == 90
    assert row.repeat.juz == 3


def test_upsert_records_updates_in_place_instead_of_duplicating(db: Session):
    _, _, _, group, student = _setup_hafiz(db)
    on_date = date(2026, 9, 7)

    hifz_service.upsert_records(
        db, group_id=group.id, on_date=on_date, records=[HifzRecordUpsert(student_id=student.id, kind=HifzKind.HIFZ, score=70)]
    )
    db.flush()
    hifz_service.upsert_records(
        db, group_id=group.id, on_date=on_date, records=[HifzRecordUpsert(student_id=student.id, kind=HifzKind.HIFZ, score=95)]
    )
    db.flush()

    roster = hifz_service.roster_for_group_date(db, group_id=group.id, on_date=on_date)
    assert len(roster) == 1
    assert roster[0].hifz.score == 95


def test_upsert_records_rejects_a_student_not_in_the_group(db: Session):
    _, _, _, group, student = _setup_hafiz(db)
    other_department = make_department(db, name="Other")
    other_group = make_group(db, other_department, name="Other-Hafiz", group_type=GroupType.HAFIZ)
    outside_student = make_student(db, other_group, full_name="Outsider")

    with pytest.raises(ValueError):
        hifz_service.upsert_records(
            db,
            group_id=group.id,
            on_date=date(2026, 9, 7),
            records=[HifzRecordUpsert(student_id=outside_student.id, kind=HifzKind.HIFZ, score=50)],
        )
    # Nothing should have been written for either student.
    roster = hifz_service.roster_for_group_date(db, group_id=group.id, on_date=date(2026, 9, 7))
    assert roster[0].hifz.score is None


def test_upsert_records_handles_duplicate_student_kind_in_one_call_without_crashing(db: Session):
    _, _, _, group, student = _setup_hafiz(db)

    hifz_service.upsert_records(
        db,
        group_id=group.id,
        on_date=date(2026, 9, 7),
        records=[
            HifzRecordUpsert(student_id=student.id, kind=HifzKind.HIFZ, score=10),
            HifzRecordUpsert(student_id=student.id, kind=HifzKind.HIFZ, score=99),
        ],
    )
    db.flush()

    roster = hifz_service.roster_for_group_date(db, group_id=group.id, on_date=date(2026, 9, 7))
    assert roster[0].hifz.score == 99


def test_roster_shows_no_marks_yet_for_students_with_no_record(db: Session):
    _, _, _, group, student = _setup_hafiz(db)

    roster = hifz_service.roster_for_group_date(db, group_id=group.id, on_date=date(2026, 9, 7))
    assert len(roster) == 1
    assert roster[0].student_id == student.id
    assert roster[0].hifz.score is None
    assert roster[0].repeat.score is None


def test_target_rejects_period_longer_than_400_days():
    with pytest.raises(ValidationError):
        HifzTargetCreate(
            student_id=1,
            kind=HifzKind.HIFZ,
            start_date=date(2026, 1, 1),
            end_date=date(2027, 6, 1),  # > 400 days
        )


def test_target_rejects_juz_to_less_than_juz_from():
    with pytest.raises(ValidationError):
        HifzTargetCreate(
            student_id=1,
            kind=HifzKind.HIFZ,
            juz_from=10,
            juz_to=5,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 2, 1),
        )


def test_target_rejects_page_to_less_than_page_from():
    with pytest.raises(ValidationError):
        HifzTargetCreate(
            student_id=1,
            kind=HifzKind.HIFZ,
            page_from=100,
            page_to=50,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 2, 1),
        )


def test_target_accepts_a_valid_range_within_400_days(db: Session):
    _, _, _, _, student = _setup_hafiz(db)
    payload = HifzTargetCreate(
        student_id=student.id,
        kind=HifzKind.HIFZ,
        juz_from=1,
        juz_to=3,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 1),
    )
    target = hifz_service.create_target(db, payload=payload)
    assert target.id is not None
    assert target.juz_from == 1


def test_update_target_rejects_a_patch_that_breaks_range_against_stored_values(db: Session):
    from app.schemas.hifz import HifzTargetUpdate

    _, _, _, _, student = _setup_hafiz(db)
    target = hifz_service.create_target(
        db,
        payload=HifzTargetCreate(
            student_id=student.id,
            kind=HifzKind.HIFZ,
            juz_from=20,
            juz_to=25,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 2, 1),
        ),
    )

    # Only juz_to is in the PATCH body, but merged against the stored juz_from=20 it's invalid.
    with pytest.raises(ValueError):
        hifz_service.update_target(db, target=target, payload=HifzTargetUpdate(juz_to=3))


def test_update_exam_rejects_a_patch_that_breaks_range_against_stored_values(db: Session):
    from app.schemas.hifz import HifzExamCreate, HifzExamUpdate

    _, _, _, _, student = _setup_hafiz(db)
    exam = hifz_service.create_exam(
        db,
        payload=HifzExamCreate(
            student_id=student.id, date=date(2026, 9, 10), title="Exam", juz_from=20, juz_to=25
        ),
    )

    with pytest.raises(ValueError):
        hifz_service.update_exam(db, exam=exam, payload=HifzExamUpdate(juz_to=3))


def test_teacher_hifz_group_ids_only_includes_assigned_hafiz_groups(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    subject = make_subject(db, department)
    semester_group = make_group(db, department, name="Hafiz-A", group_type=GroupType.HAFIZ)
    regular_group = make_group(db, department, name="Regular-A", group_type=GroupType.REGULAR)

    from tests.factories import make_semester

    semester = make_semester(db)
    make_assignment(db, teacher, subject, semester_group, semester)
    make_assignment(db, teacher, subject, regular_group, semester)
    db.flush()

    group_ids = hifz_service.teacher_hifz_group_ids(db, teacher_id=teacher.id)
    assert group_ids == [semester_group.id]


def test_teacher_hifz_group_ids_empty_without_any_assignment(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    make_group(db, department, group_type=GroupType.HAFIZ)

    assert hifz_service.teacher_hifz_group_ids(db, teacher_id=teacher.id) == []


def test_exam_crud_is_independent_of_daily_records(db: Session):
    _, _, _, group, student = _setup_hafiz(db)
    from app.schemas.hifz import HifzExamCreate, HifzExamUpdate

    hifz_service.upsert_records(
        db,
        group_id=group.id,
        on_date=date(2026, 9, 7),
        records=[HifzRecordUpsert(student_id=student.id, kind=HifzKind.HIFZ, score=60)],
    )
    db.flush()

    exam = hifz_service.create_exam(
        db, payload=HifzExamCreate(student_id=student.id, date=date(2026, 9, 10), title="Жарым жылдык", score=88)
    )
    assert exam.score == 88

    exams = hifz_service.list_exams(db, student_id=student.id)
    assert len(exams) == 1

    updated = hifz_service.update_exam(db, exam=exam, payload=HifzExamUpdate(score=92))
    assert updated.score == 92

    # Daily record from before is untouched by the exam.
    roster = hifz_service.roster_for_group_date(db, group_id=group.id, on_date=date(2026, 9, 7))
    assert roster[0].hifz.score == 60

    hifz_service.delete_exam(db, exam=updated)
    assert hifz_service.list_exams(db, student_id=student.id) == []
