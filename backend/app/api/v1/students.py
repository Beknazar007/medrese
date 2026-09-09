from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import accessible_department_ids, assert_department_access, get_current_user, require_role
from app.db.session import get_db
from app.models.assignment import TeachingAssignment
from app.models.enums import UserRole
from app.models.group import Group
from app.models.student import Student
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.schemas.journal import StudentHistoryRow
from app.schemas.student import StudentCreate, StudentOut, StudentUpdate
from app.services import journal as journal_service

router = APIRouter(prefix="/students", tags=["students"])


def _teacher_group_ids(db: Session, current_user: User) -> list[int]:
    teacher = db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == current_user.id))
    if teacher is None:
        return []
    return list(db.scalars(select(TeachingAssignment.group_id).where(TeachingAssignment.teacher_id == teacher.id)).all())


@router.get("", response_model=list[StudentOut])
def list_students(
    group_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Student]:
    stmt = select(Student)
    if current_user.role == UserRole.TEACHER:
        stmt = stmt.where(Student.group_id.in_(_teacher_group_ids(db, current_user)))
    else:
        dept_ids = accessible_department_ids(current_user)
        if dept_ids is not None:
            stmt = stmt.join(Group).where(Group.department_id.in_(dept_ids))
    if group_id is not None:
        stmt = stmt.where(Student.group_id == group_id)
    return list(db.scalars(stmt).all())


@router.get("/{student_id}", response_model=StudentOut)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Student:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    if current_user.role == UserRole.TEACHER:
        if student.group_id not in _teacher_group_ids(db, current_user):
            raise HTTPException(status_code=403, detail="You do not teach this student's group")
    elif current_user.role == UserRole.DEAN:
        assert_department_access(current_user, student.group.department_id)
    return student


@router.get("/{student_id}/history", response_model=list[StudentHistoryRow])
def get_student_history(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[StudentHistoryRow]:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    teacher_id_filter: int | None = None
    if current_user.role == UserRole.TEACHER:
        if student.group_id not in _teacher_group_ids(db, current_user):
            raise HTTPException(status_code=403, detail="You do not teach this student's group")
        teacher = db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == current_user.id))
        teacher_id_filter = teacher.id if teacher is not None else None
    elif current_user.role == UserRole.DEAN:
        assert_department_access(current_user, student.group.department_id)

    return journal_service.student_history(
        db, student_id=student_id, group_id=student.group_id, teacher_id=teacher_id_filter
    )


@router.post("", response_model=StudentOut, status_code=201)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> Student:
    group = db.get(Group, payload.group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    assert_department_access(current_user, group.department_id)

    student = Student(**payload.model_dump())
    db.add(student)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Student number already exists") from exc
    db.refresh(student)
    return student


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> Student:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    assert_department_access(current_user, student.group.department_id)
    if payload.group_id is not None:
        new_group = db.get(Group, payload.group_id)
        if new_group is None:
            raise HTTPException(status_code=404, detail="Group not found")
        assert_department_access(current_user, new_group.department_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(student, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Student number already exists") from exc
    db.refresh(student)
    return student


@router.delete("/{student_id}", status_code=204)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> None:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    assert_department_access(current_user, student.group.department_id)
    db.delete(student)
    db.commit()
