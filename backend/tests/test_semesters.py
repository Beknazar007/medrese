from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.semesters import _deactivate_other_semesters
from app.models.semester import Semester


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
