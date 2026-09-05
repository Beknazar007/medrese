from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.services.workload import teacher_workload, unassigned_subjects

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/workload")
def get_workload(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
):
    department_id = None
    if current_user.role == UserRole.DEAN and current_user.headed_department is not None:
        department_id = current_user.headed_department.id

    return teacher_workload(db, semester_id=semester_id, department_id=department_id)


@router.get("/unassigned-subjects")
def get_unassigned_subjects(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
):
    department_id = None
    if current_user.role == UserRole.DEAN and current_user.headed_department is not None:
        department_id = current_user.headed_department.id

    return unassigned_subjects(db, semester_id=semester_id, department_id=department_id)
