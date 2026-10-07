from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api.v1.students import delete_student, student_record_counts
from app.models.enums import HifzKind, NoteVisibility, UserRole
from app.models.hifz import HifzTarget
from app.models.note import StudentNote
from app.models.student import Student
from app.models.user import User
from tests.factories import make_department, make_group, make_student, make_teacher


def _rector(db: Session) -> User:
    user = User(username="rector", hashed_password="x", role=UserRole.RECTOR)
    db.add(user)
    db.flush()
    return user


def _student_with_records(db: Session) -> Student:
    department = make_department(db)
    teacher = make_teacher(db, department)
    student = make_student(db, make_group(db, department))
    db.add(StudentNote(student_id=student.id, author_teacher_id=teacher.id, body="n", visibility=NoteVisibility.SHARED))
    db.add(
        HifzTarget(
            student_id=student.id, kind=HifzKind.HIFZ, start_date=date(2026, 9, 1), end_date=date(2026, 9, 30)
        )
    )
    db.commit()
    return student


def test_plain_delete_of_a_student_with_records_is_refused(db: Session):
    rector = _rector(db)
    student = _student_with_records(db)

    with pytest.raises(HTTPException) as exc:
        delete_student(student.id, force=False, db=db, current_user=rector)

    assert exc.value.status_code == 409
    assert db.get(Student, student.id) is not None


def test_force_delete_removes_the_student_and_every_record(db: Session):
    rector = _rector(db)
    student = _student_with_records(db)
    student_id = student.id

    counts = student_record_counts(student_id, db=db, current_user=rector)
    assert (counts.attendance, counts.grades, counts.notes, counts.hifz) == (0, 0, 1, 1)

    delete_student(student_id, force=True, db=db, current_user=rector)

    db.expire_all()
    assert db.get(Student, student_id) is None
    assert db.query(StudentNote).filter_by(student_id=student_id).count() == 0
    assert db.query(HifzTarget).filter_by(student_id=student_id).count() == 0
