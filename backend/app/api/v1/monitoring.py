from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import assert_department_access, department_scope, require_role
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.lesson_mark import LessonMark
from app.models.schedule import ScheduleEntry
from app.models.semester import Semester
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.schemas.monitoring import LessonMarkOut, LessonMarkUpsert, TeacherMonitoringRowOut, TeacherSessionLogRowOut
from app.services import monitoring as monitoring_service
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


def _assert_can_mark(db: Session, current_user: User, entry: ScheduleEntry, on_date) -> None:
    """A dean may mark only lessons of their own department's teachers — the teacher who
    answered for that date, which after a replacement may not be the current one."""
    department_scope(current_user)
    teacher = db.get(TeacherProfile, monitoring_service.lesson_teacher_id(db, entry, on_date))
    if teacher is None:
        raise HTTPException(status_code=404, detail="Teacher not found")
    assert_department_access(current_user, teacher.department_id)


@router.put("/lesson-marks", response_model=LessonMarkOut)
def put_lesson_mark(
    payload: LessonMarkUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
):
    """Set or change the reason on a lesson that was never opened. Never creates a lesson,
    attendance or grades."""
    entry = db.get(ScheduleEntry, payload.schedule_entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    _assert_can_mark(db, current_user, entry, payload.date)
    try:
        mark = monitoring_service.upsert_mark(
            db,
            entry=entry,
            on_date=payload.date,
            kind=payload.kind,
            comment=payload.comment,
            user=current_user,
            now=monitoring_service.now_bishkek(),
        )
    except monitoring_service.WrongWeekday as exc:
        raise HTTPException(status_code=422, detail=exc.code) from exc
    except monitoring_service.MarkTargetError as exc:
        raise HTTPException(status_code=409, detail=exc.code) from exc
    db.commit()
    db.refresh(mark)
    return monitoring_service.mark_view(mark)


@router.delete("/lesson-marks/{mark_id}", status_code=204)
def delete_lesson_mark(
    mark_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> None:
    mark = db.get(LessonMark, mark_id)
    if mark is None:
        raise HTTPException(status_code=404, detail="Lesson mark not found")
    entry = db.get(ScheduleEntry, mark.schedule_entry_id)
    _assert_can_mark(db, current_user, entry, mark.date)
    monitoring_service.delete_mark(db, mark)
    db.commit()
