from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.faculty import Faculty
from app.schemas.faculty import FacultyCreate, FacultyOut

router = APIRouter(prefix="/faculties", tags=["faculties"])


@router.get("", response_model=list[FacultyOut])
def list_faculties(db: Session = Depends(get_db), _=Depends(get_current_user)) -> list[Faculty]:
    return list(db.scalars(select(Faculty)).all())


@router.post("", response_model=FacultyOut, status_code=201)
def create_faculty(
    payload: FacultyCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> Faculty:
    faculty = Faculty(name=payload.name)
    db.add(faculty)
    db.commit()
    db.refresh(faculty)
    return faculty


@router.patch("/{faculty_id}", response_model=FacultyOut)
def update_faculty(
    faculty_id: int,
    payload: FacultyCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> Faculty:
    faculty = db.get(Faculty, faculty_id)
    if faculty is None:
        raise HTTPException(status_code=404, detail="Faculty not found")
    faculty.name = payload.name
    db.commit()
    db.refresh(faculty)
    return faculty


@router.delete("/{faculty_id}", status_code=204)
def delete_faculty(
    faculty_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> None:
    faculty = db.get(Faculty, faculty_id)
    if faculty is None:
        raise HTTPException(status_code=404, detail="Faculty not found")
    db.delete(faculty)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cannot delete a faculty that still has departments") from exc
