from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import accessible_department_ids, assert_department_access, require_role
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.excuse import StudentExcuse
from app.models.group import Group
from app.models.student import Student
from app.models.user import User
from app.schemas.excuse import ExcuseCreate, ExcuseOut, ExcuseUpdate
from app.services import excuses as excuse_service

router = APIRouter(prefix="/excuses", tags=["excuses"])

DEANERY = (UserRole.RECTOR, UserRole.DEAN)


def _out(excuse: StudentExcuse) -> ExcuseOut:
    return ExcuseOut(
        id=excuse.id,
        student_id=excuse.student_id,
        student_name=excuse.student.full_name,
        group_id=excuse.student.group_id,
        date_from=excuse.date_from,
        date_to=excuse.date_to,
        reason=excuse.reason,
        created_by=excuse.created_by.username if excuse.created_by is not None else None,
        created_at=excuse.created_at,
    )


def _get_or_404(db: Session, current_user: User, excuse_id: int) -> StudentExcuse:
    excuse = db.get(StudentExcuse, excuse_id)
    if excuse is None:
        raise HTTPException(status_code=404, detail="Excuse not found")
    assert_department_access(current_user, excuse.student.group.department_id)
    return excuse


@router.get("", response_model=list[ExcuseOut])
def list_excuses(
    student_id: int | None = None,
    group_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*DEANERY)),
) -> list[ExcuseOut]:
    stmt = select(StudentExcuse).join(Student, Student.id == StudentExcuse.student_id).join(Group)
    dept_ids = accessible_department_ids(current_user)
    if dept_ids is not None:
        stmt = stmt.where(Group.department_id.in_(dept_ids))
    if student_id is not None:
        stmt = stmt.where(StudentExcuse.student_id == student_id)
    if group_id is not None:
        stmt = stmt.where(Student.group_id == group_id)
    if date_from is not None:
        stmt = stmt.where(StudentExcuse.date_to >= date_from)
    if date_to is not None:
        stmt = stmt.where(StudentExcuse.date_from <= date_to)
    stmt = stmt.order_by(StudentExcuse.date_from.desc(), StudentExcuse.id.desc())
    return [_out(e) for e in db.scalars(stmt).all()]


@router.post("", response_model=ExcuseOut, status_code=201)
def create_excuse(
    payload: ExcuseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*DEANERY)),
) -> ExcuseOut:
    student = db.get(Student, payload.student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    assert_department_access(current_user, student.group.department_id)
    excuse = StudentExcuse(
        student_id=student.id,
        date_from=payload.date_from,
        date_to=payload.date_to,
        reason=payload.reason.strip(),
        created_by_id=current_user.id,
    )
    db.add(excuse)
    db.flush()
    excuse_service.resync_student(db, student.id)
    db.commit()
    db.refresh(excuse)
    return _out(excuse)


@router.patch("/{excuse_id}", response_model=ExcuseOut)
def update_excuse(
    excuse_id: int,
    payload: ExcuseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*DEANERY)),
) -> ExcuseOut:
    excuse = _get_or_404(db, current_user, excuse_id)
    date_from = payload.date_from or excuse.date_from
    date_to = payload.date_to or excuse.date_to
    if date_to < date_from:
        raise HTTPException(status_code=400, detail="The end date is before the start date")
    # Lessons that fall out of the new range go back to unmarked; resync re-marks the rest.
    excuse_service.remove_marks(db, excuse)
    excuse.date_from = date_from
    excuse.date_to = date_to
    if payload.reason is not None:
        excuse.reason = payload.reason.strip()
    db.flush()
    excuse_service.resync_student(db, excuse.student_id)
    db.commit()
    db.refresh(excuse)
    return _out(excuse)


@router.delete("/{excuse_id}", status_code=204)
def delete_excuse(
    excuse_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*DEANERY)),
) -> None:
    excuse = _get_or_404(db, current_user, excuse_id)
    student_id = excuse.student_id
    excuse_service.remove_marks(db, excuse)
    db.delete(excuse)
    db.flush()
    excuse_service.resync_student(db, student_id)
    db.commit()
