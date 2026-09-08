from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.semester import Semester
from app.schemas.semester import SemesterCreate, SemesterOut, SemesterUpdate

router = APIRouter(prefix="/semesters", tags=["semesters"])


def _deactivate_other_semesters(db: Session, *, keep_id: int | None) -> None:
    """Only one semester may be active at a time — it's what the dashboard and the
    teacher journal both fall back to when no semester is explicitly picked, so two
    active semesters would make that fallback ambiguous."""
    stmt = update(Semester).where(Semester.is_active.is_(True))
    if keep_id is not None:
        stmt = stmt.where(Semester.id != keep_id)
    db.execute(stmt.values(is_active=False))


@router.get("", response_model=list[SemesterOut])
def list_semesters(db: Session = Depends(get_db), _=Depends(get_current_user)) -> list[Semester]:
    return list(db.scalars(select(Semester)).all())


@router.post("", response_model=SemesterOut, status_code=201)
def create_semester(
    payload: SemesterCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> Semester:
    semester = Semester(**payload.model_dump())
    db.add(semester)
    db.flush()
    if semester.is_active:
        _deactivate_other_semesters(db, keep_id=semester.id)
    db.commit()
    db.refresh(semester)
    return semester


@router.patch("/{semester_id}", response_model=SemesterOut)
def update_semester(
    semester_id: int,
    payload: SemesterUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> Semester:
    semester = db.get(Semester, semester_id)
    if semester is None:
        raise HTTPException(status_code=404, detail="Semester not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(semester, field, value)
    if semester.is_active:
        _deactivate_other_semesters(db, keep_id=semester.id)
    db.commit()
    db.refresh(semester)
    return semester


@router.delete("/{semester_id}", status_code=204)
def delete_semester(
    semester_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> None:
    semester = db.get(Semester, semester_id)
    if semester is None:
        raise HTTPException(status_code=404, detail="Semester not found")
    db.delete(semester)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Cannot delete a semester that still has assignments or schedule entries"
        ) from exc
