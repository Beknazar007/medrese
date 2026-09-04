from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import assert_department_access, get_current_user, require_role
from app.db.session import get_db
from app.models.department import Department
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate


def _validate_head(db: Session, head_user_id: int | None) -> None:
    if head_user_id is None:
        return
    head = db.get(User, head_user_id)
    if head is None or head.role != UserRole.DEAN:
        raise HTTPException(status_code=400, detail="head_user_id must belong to an existing Dean account")

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db), _=Depends(get_current_user)) -> list[Department]:
    return list(db.scalars(select(Department)).all())


@router.post("", response_model=DepartmentOut, status_code=201)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> Department:
    _validate_head(db, payload.head_user_id)
    department = Department(**payload.model_dump())
    db.add(department)
    db.commit()
    db.refresh(department)
    return department


@router.patch("/{department_id}", response_model=DepartmentOut)
def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> Department:
    department = db.get(Department, department_id)
    if department is None:
        raise HTTPException(status_code=404, detail="Department not found")
    assert_department_access(current_user, department_id)
    if "head_user_id" in payload.model_fields_set:
        _validate_head(db, payload.head_user_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(department, field, value)
    db.commit()
    db.refresh(department)
    return department


@router.delete("/{department_id}", status_code=204)
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> None:
    department = db.get(Department, department_id)
    if department is None:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(department)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Cannot delete a department that still has teachers, subjects, or groups"
        ) from exc
