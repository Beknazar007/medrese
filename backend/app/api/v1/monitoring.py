from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import assert_department_access, department_scope, require_role
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.semester import Semester
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.schemas.monitoring import TeacherMonitoringRowOut, TeacherSessionLogRowOut
from app.services.monitoring import teacher_monitoring, teacher_session_log

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


def get_semester_or_404(db: Session, semester_id: int) -> Semester:
    semester = db.get(Semester, semester_id)
    if semester is None:
        raise HTTPException(status_code=404, detail="Semester not found")
    return semester


@router.get("/teachers", response_model=list[TeacherMonitoringRowOut])
def get_teacher_monitoring(
    semester_id: int,
    date_from: date,
    date_to: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
):
    department_id = department_scope(current_user)
    get_semester_or_404(db, semester_id)
    return teacher_monitoring(
        db, semester_id=semester_id, date_from=date_from, date_to=date_to, department_id=department_id
    )


@router.get("/teachers/{teacher_id}/sessions", response_model=list[TeacherSessionLogRowOut])
def get_teacher_session_log(
    teacher_id: int,
    semester_id: int,
    date_from: date,
    date_to: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
):
    department_scope(current_user)
    teacher = db.get(TeacherProfile, teacher_id)
    if teacher is None:
        raise HTTPException(status_code=404, detail="Teacher not found")
    assert_department_access(current_user, teacher.department_id)
    get_semester_or_404(db, semester_id)

    rows = teacher_session_log(db, teacher_id=teacher_id, semester_id=semester_id, date_from=date_from, date_to=date_to)
    db.commit()  # persists any lessons that teacher_session_log just auto-closed
    return rows
