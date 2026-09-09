from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import assert_department_access, require_role
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.services.monitoring import teacher_monitoring, teacher_session_log

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/teachers")
def get_teacher_monitoring(
    semester_id: int,
    date_from: date,
    date_to: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
):
    department_id = None
    if current_user.role == UserRole.DEAN and current_user.headed_department is not None:
        department_id = current_user.headed_department.id

    return teacher_monitoring(
        db, semester_id=semester_id, date_from=date_from, date_to=date_to, department_id=department_id
    )


@router.get("/teachers/{teacher_id}/sessions")
def get_teacher_session_log(
    teacher_id: int,
    semester_id: int,
    date_from: date,
    date_to: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
):
    if current_user.role == UserRole.DEAN:
        teacher = db.get(TeacherProfile, teacher_id)
        if teacher is None:
            raise HTTPException(status_code=404, detail="Teacher not found")
        assert_department_access(current_user, teacher.department_id)

    return teacher_session_log(db, teacher_id=teacher_id, semester_id=semester_id, date_from=date_from, date_to=date_to)
