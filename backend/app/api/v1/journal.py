from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import assert_department_access, get_current_user, require_role
from app.db.session import get_db
from app.models.assignment import TeachingAssignment
from app.models.enums import UserRole
from app.models.lesson_session import LessonSession
from app.models.schedule import ScheduleEntry
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.schemas.journal import (
    BulkAttendanceRequest,
    BulkGradeRequest,
    LessonSessionDetailOut,
    LessonSessionOut,
    SessionGetOrCreate,
    StudentPerformanceRow,
)
from app.services import journal as journal_service

router = APIRouter(prefix="/journal", tags=["journal"])


def _get_own_teacher(db: Session, current_user: User) -> TeacherProfile:
    teacher = db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == current_user.id))
    if teacher is None:
        raise HTTPException(status_code=403, detail="This account has no teacher profile")
    return teacher


def _assert_can_access_entry(db: Session, current_user: User, entry: ScheduleEntry) -> None:
    if current_user.role == UserRole.TEACHER:
        teacher = _get_own_teacher(db, current_user)
        if entry.assignment.teacher_id != teacher.id:
            raise HTTPException(status_code=403, detail="You do not teach this class")
    else:
        assert_department_access(current_user, entry.assignment.teacher.department_id)


@router.post("/sessions", response_model=LessonSessionDetailOut)
def get_or_create_session(
    payload: SessionGetOrCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> LessonSessionDetailOut:
    entry = db.get(ScheduleEntry, payload.schedule_entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    _assert_can_access_entry(db, current_user, entry)

    session = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=payload.date)
    db.commit()
    db.refresh(session)
    roster = journal_service.roster_for_session(db, session)
    return LessonSessionDetailOut(session=LessonSessionOut.model_validate(session), roster=roster)


@router.get("/sessions/{session_id}", response_model=LessonSessionDetailOut)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LessonSessionDetailOut:
    session = db.get(LessonSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    _assert_can_access_entry(db, current_user, session.schedule_entry)

    roster = journal_service.roster_for_session(db, session)
    return LessonSessionDetailOut(session=LessonSessionOut.model_validate(session), roster=roster)


@router.get("/sessions", response_model=list[LessonSessionOut])
def list_sessions(
    schedule_entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LessonSession]:
    entry = db.get(ScheduleEntry, schedule_entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    _assert_can_access_entry(db, current_user, entry)

    return list(
        db.scalars(
            select(LessonSession)
            .where(LessonSession.schedule_entry_id == schedule_entry_id)
            .order_by(LessonSession.date.desc())
        ).all()
    )


@router.put("/sessions/{session_id}/attendance", response_model=LessonSessionDetailOut)
def put_attendance(
    session_id: int,
    payload: BulkAttendanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> LessonSessionDetailOut:
    session = db.get(LessonSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    _assert_can_access_entry(db, current_user, session.schedule_entry)

    journal_service.upsert_attendance(db, session=session, records=payload.records)
    db.commit()
    roster = journal_service.roster_for_session(db, session)
    return LessonSessionDetailOut(session=LessonSessionOut.model_validate(session), roster=roster)


@router.put("/sessions/{session_id}/grades", response_model=LessonSessionDetailOut)
def put_grades(
    session_id: int,
    payload: BulkGradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> LessonSessionDetailOut:
    session = db.get(LessonSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    _assert_can_access_entry(db, current_user, session.schedule_entry)

    journal_service.upsert_grades(db, session=session, records=payload.records)
    db.commit()
    roster = journal_service.roster_for_session(db, session)
    return LessonSessionDetailOut(session=LessonSessionOut.model_validate(session), roster=roster)


@router.put("/sessions/{session_id}/check-out", response_model=LessonSessionOut)
def check_out(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> LessonSession:
    session = db.get(LessonSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    _assert_can_access_entry(db, current_user, session.schedule_entry)

    journal_service.check_out_session(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/performance", response_model=list[StudentPerformanceRow])
def get_performance(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignment = db.get(TeachingAssignment, assignment_id)
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if current_user.role == UserRole.TEACHER:
        teacher = _get_own_teacher(db, current_user)
        if assignment.teacher_id != teacher.id:
            raise HTTPException(status_code=403, detail="You do not teach this class")
    else:
        assert_department_access(current_user, assignment.teacher.department_id)

    return journal_service.student_performance(db, assignment_id=assignment_id)
