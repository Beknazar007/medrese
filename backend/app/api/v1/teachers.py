from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import (
    accessible_department_ids,
    assert_department_access,
    get_current_user,
    require_role,
)
from app.core.security import hash_password
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.schemas.teacher import TeacherCreate, TeacherOut, TeacherUpdate

router = APIRouter(prefix="/teachers", tags=["teachers"])


@router.get("", response_model=list[TeacherOut])
def list_teachers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TeacherProfile]:
    dept_ids = accessible_department_ids(current_user)
    stmt = select(TeacherProfile)
    if dept_ids is not None:
        stmt = stmt.where(TeacherProfile.department_id.in_(dept_ids))
    return list(db.scalars(stmt).all())


@router.get("/me", response_model=TeacherOut)
def get_my_teacher_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeacherProfile:
    teacher = db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == current_user.id))
    if teacher is None:
        raise HTTPException(status_code=404, detail="No teacher profile for this account")
    return teacher


@router.get("/{teacher_id}", response_model=TeacherOut)
def get_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeacherProfile:
    teacher = db.get(TeacherProfile, teacher_id)
    if teacher is None:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if current_user.role == UserRole.TEACHER and teacher.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You may only view your own profile")
    if current_user.role == UserRole.DEAN:
        assert_department_access(current_user, teacher.department_id)
    return teacher


@router.post("", response_model=TeacherOut, status_code=201)
def create_teacher(
    payload: TeacherCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> TeacherProfile:
    assert_department_access(current_user, payload.department_id)

    if db.scalar(select(User).where(User.username == payload.username)) is not None:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=UserRole.TEACHER,
    )
    db.add(user)
    db.flush()  # assign user.id without committing

    teacher = TeacherProfile(
        user_id=user.id,
        department_id=payload.department_id,
        full_name=payload.full_name,
        academic_degree=payload.academic_degree,
        phone=payload.phone,
        hire_date=payload.hire_date,
        bio=payload.bio,
        photo=payload.photo,
        education=payload.education,
        competency=payload.competency,
        teaching_experience_years=payload.teaching_experience_years,
        previous_subjects=payload.previous_subjects,
        can_teach=payload.can_teach,
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return teacher


@router.patch("/{teacher_id}", response_model=TeacherOut)
def update_teacher(
    teacher_id: int,
    payload: TeacherUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> TeacherProfile:
    teacher = db.get(TeacherProfile, teacher_id)
    if teacher is None:
        raise HTTPException(status_code=404, detail="Teacher not found")
    assert_department_access(current_user, teacher.department_id)
    if payload.department_id is not None:
        assert_department_access(current_user, payload.department_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(teacher, field, value)
    db.commit()
    db.refresh(teacher)
    return teacher


@router.delete("/{teacher_id}", status_code=204)
def delete_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> None:
    teacher = db.get(TeacherProfile, teacher_id)
    if teacher is None:
        raise HTTPException(status_code=404, detail="Teacher not found")
    assert_department_access(current_user, teacher.department_id)

    user = db.get(User, teacher.user_id)
    db.delete(teacher)
    if user is not None:
        db.delete(user)
    db.commit()
