from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import accessible_department_ids, assert_department_access, get_current_user, require_role
from app.db.session import get_db
from app.models.assignment import TeachingAssignment
from app.models.enums import UserRole
from app.models.group import Group
from app.models.subject import Subject
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.schemas.assignment import TeachingAssignmentCreate, TeachingAssignmentOut

router = APIRouter(prefix="/assignments", tags=["assignments"])


def _get_or_404(db: Session, model, obj_id: int, label: str):
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return obj


@router.get("", response_model=list[TeachingAssignmentOut])
def list_assignments(
    semester_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TeachingAssignment]:
    dept_ids = accessible_department_ids(current_user)
    stmt = select(TeachingAssignment)
    if dept_ids is not None:
        stmt = stmt.join(TeacherProfile).where(TeacherProfile.department_id.in_(dept_ids))
    if semester_id is not None:
        stmt = stmt.where(TeachingAssignment.semester_id == semester_id)
    return list(db.scalars(stmt).all())


@router.post("", response_model=TeachingAssignmentOut, status_code=201)
def create_assignment(
    payload: TeachingAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> TeachingAssignment:
    teacher = _get_or_404(db, TeacherProfile, payload.teacher_id, "Teacher")
    subject = _get_or_404(db, Subject, payload.subject_id, "Subject")
    group = _get_or_404(db, Group, payload.group_id, "Group")

    # A Dean may only assign teachers/subjects/groups within the department they head.
    assert_department_access(current_user, teacher.department_id)
    assert_department_access(current_user, subject.department_id)
    assert_department_access(current_user, group.department_id)

    assignment = TeachingAssignment(**payload.model_dump())
    db.add(assignment)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This teacher is already assigned to this subject/group/semester/hour type",
        ) from exc
    db.refresh(assignment)
    return assignment


@router.delete("/{assignment_id}", status_code=204)
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> None:
    assignment = _get_or_404(db, TeachingAssignment, assignment_id, "Assignment")
    assert_department_access(current_user, assignment.teacher.department_id)
    db.delete(assignment)
    db.commit()
