from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import accessible_department_ids, assert_department_access, get_current_user, require_role
from app.db.session import get_db
from app.models.assignment import TeachingAssignment
from app.models.enums import UserRole
from app.models.group import Group
from app.models.schedule import ScheduleEntry
from app.models.semester import Semester
from app.models.subject import Subject
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.schemas.assignment import TeachingAssignmentCreate, TeachingAssignmentOut, TeachingAssignmentUpdate
from app.services import assignments as assignment_service

router = APIRouter(prefix="/assignments", tags=["assignments"])

DUPLICATE_DETAIL = "This teacher is already assigned to this subject/group/semester/hour type"


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
    stmt = select(TeachingAssignment)
    if current_user.role == UserRole.TEACHER:
        teacher = db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == current_user.id))
        if teacher is None:
            return []
        stmt = stmt.where(TeachingAssignment.teacher_id == teacher.id)
    else:
        dept_ids = accessible_department_ids(current_user)
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
        raise HTTPException(status_code=409, detail=DUPLICATE_DETAIL) from exc
    db.refresh(assignment)
    return assignment


@router.patch("/{assignment_id}", response_model=TeachingAssignmentOut)
def update_assignment(
    assignment_id: int,
    payload: TeachingAssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> TeachingAssignment:
    assignment = _get_or_404(db, TeachingAssignment, assignment_id, "Assignment")
    old_teacher = assignment.teacher
    # A dean must own the assignment as it is now *and* everything it would point to after.
    assert_department_access(current_user, old_teacher.department_id)

    teacher_id = payload.teacher_id if payload.teacher_id is not None else assignment.teacher_id
    subject_id = payload.subject_id if payload.subject_id is not None else assignment.subject_id
    group_id = payload.group_id if payload.group_id is not None else assignment.group_id
    semester_id = payload.semester_id if payload.semester_id is not None else assignment.semester_id
    hour_type = payload.hour_type if payload.hour_type is not None else assignment.hour_type

    teacher = _get_or_404(db, TeacherProfile, teacher_id, "Teacher")
    subject = _get_or_404(db, Subject, subject_id, "Subject")
    group = _get_or_404(db, Group, group_id, "Group")
    _get_or_404(db, Semester, semester_id, "Semester")
    assert_department_access(current_user, teacher.department_id)
    assert_department_access(current_user, subject.department_id)
    assert_department_access(current_user, group.department_id)

    has_entries = db.scalar(select(exists().where(ScheduleEntry.assignment_id == assignment.id)))
    if has_entries and (group_id != assignment.group_id or semester_id != assignment.semester_id):
        # Schedule entries carry copies of group and semester for the no-double-booking
        # constraints; moving them would mean re-checking every slot of another group/semester.
        raise HTTPException(
            status_code=409, detail="Cannot change the group or semester of an assignment that is in the timetable"
        )

    duplicate = db.scalar(
        select(TeachingAssignment.id).where(
            TeachingAssignment.id != assignment.id,
            TeachingAssignment.teacher_id == teacher_id,
            TeachingAssignment.subject_id == subject_id,
            TeachingAssignment.group_id == group_id,
            TeachingAssignment.semester_id == semester_id,
            TeachingAssignment.hour_type == hour_type,
        )
    )
    if duplicate is not None:
        raise HTTPException(status_code=409, detail=DUPLICATE_DETAIL)

    if has_entries and teacher_id != assignment.teacher_id:
        if teacher.department_id != old_teacher.department_id:
            # Monitoring and history are per department; a replacement across departments
            # would split one assignment's lessons between two deans' reports.
            raise HTTPException(
                status_code=400, detail="The new teacher must be from the same department as the assignment"
            )
        try:
            assignment_service.replace_teacher(
                db, assignment=assignment, new_teacher_id=teacher_id, changed_by_user_id=current_user.id
            )
        except assignment_service.TeacherBusyError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except IntegrityError as exc:
            # Lost a race: another request booked one of these slots for the new teacher
            # between the clash check and the UPDATE of the schedule entries.
            db.rollback()
            raise HTTPException(status_code=409, detail="This slot is already booked") from exc

    assignment.teacher_id = teacher_id
    assignment.subject_id = subject_id
    assignment.group_id = group_id
    assignment.semester_id = semester_id
    assignment.hour_type = hour_type
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # Lost a race: the same assignment was created meanwhile (schedule clashes are
        # caught above, when the entries are updated).
        raise HTTPException(status_code=409, detail=DUPLICATE_DETAIL) from exc
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
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Cannot delete an assignment that still has schedule entries"
        ) from exc
