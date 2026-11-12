from datetime import date, datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.enums import LessonMarkKind
from app.models.lesson_mark import LessonMark
from tests.factories import (
    make_assignment,
    make_department,
    make_group,
    make_room,
    make_schedule_entry,
    make_semester,
    make_subject,
    make_teacher,
    make_time_slot,
)


def _entry(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    semester = make_semester(db)
    assignment = make_assignment(db, teacher, make_subject(db, department), make_group(db, department), semester)
    return make_schedule_entry(db, assignment, make_room(db), make_time_slot(db))


def test_one_mark_per_lesson(db: Session):
    entry = _entry(db)
    now = datetime.now(timezone.utc)
    db.add(LessonMark(schedule_entry_id=entry.id, date=date(2026, 9, 7), kind=LessonMarkKind.EXCUSED, marked_at=now))
    db.flush()
    db.add(LessonMark(schedule_entry_id=entry.id, date=date(2026, 9, 7), kind=LessonMarkKind.CANCELLED, marked_at=now))
    with pytest.raises(IntegrityError):
        db.flush()
