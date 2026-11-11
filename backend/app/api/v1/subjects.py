from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import accessible_department_ids, assert_department_access, get_current_user, require_role
from app.db.session import get_db
from app.models.assignment import TeachingAssignment
from app.models.enums import UserRole
from app.models.subject import Subject
from app.models.user import User
from app.schemas.subject import SubjectCreate, SubjectOut, SubjectUpdate

router = APIRouter(prefix="/subjects", tags=["subjects"])


@router.get("", response_model=list[SubjectOut])
def list_subjects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Subject]:
    dept_ids = accessible_department_ids(current_user)
    stmt = select(Subject)
    if dept_ids is not None:
        visible = Subject.department_id.in_(dept_ids)
        if current_user.role == UserRole.TEACHER and current_user.teacher_profile is not None:
            # A rector may assign a teacher a subject of another department; without it here the
            # teacher's own timetable would show a blank name for that lesson.
            own = select(TeachingAssignment.subject_id).where(
                TeachingAssignment.teacher_id == current_user.teacher_profile.id
            )
            visible = or_(visible, Subject.id.in_(own))
        stmt = stmt.where(visible)
    return list(db.scalars(stmt).all())


@router.post("", response_model=SubjectOut, status_code=201)
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> Subject:
    assert_department_access(current_user, payload.department_id)
    if db.scalar(select(Subject).where(Subject.code == payload.code)) is not None:
        raise HTTPException(status_code=400, detail="Subject code already exists")

    subject = Subject(**payload.model_dump())
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.patch("/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> Subject:
    subject = db.get(Subject, subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Subject not found")
    assert_department_access(current_user, subject.department_id)

    # exclude_none: null in a NOT NULL column (e.g. name) means "not sent", not "erase" —
    # writing it would fail with a 500. Cleared hours were already turned into 0 by the schema.
    for field, value in payload.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(subject, field, value)
    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=204)
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> None:
    subject = db.get(Subject, subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Subject not found")
    assert_department_access(current_user, subject.department_id)
    db.delete(subject)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Cannot delete a subject that still has teaching assignments"
        ) from exc
