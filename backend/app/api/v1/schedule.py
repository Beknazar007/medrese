from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import accessible_department_ids, assert_department_access, get_current_user, require_role
from app.db.session import get_db
from app.models.assignment import TeachingAssignment
from app.models.enums import UserRole
from app.models.lesson_session import LessonSession
from app.models.schedule import ScheduleEntry
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.schemas.schedule import ScheduleEntryCreate, ScheduleEntryOut, ScheduleEntryUpdate
from app.services.schedule_conflict import ScheduleConflictError, check_for_conflicts

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("", response_model=list[ScheduleEntryOut])
def list_schedule(
    semester_id: int | None = None,
    group_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ScheduleEntry]:
    if current_user.role == UserRole.TEACHER:
        teacher = db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == current_user.id))
        if teacher is None:
            return []
        stmt = select(ScheduleEntry).where(ScheduleEntry.teacher_id == teacher.id)
        if semester_id is not None:
            stmt = stmt.where(ScheduleEntry.semester_id == semester_id)
        return list(db.scalars(stmt).all())

    dept_ids = accessible_department_ids(current_user)
    stmt = select(ScheduleEntry)
    if dept_ids is not None:
        stmt = stmt.join(TeacherProfile, ScheduleEntry.teacher_id == TeacherProfile.id).where(
            TeacherProfile.department_id.in_(dept_ids)
        )
    if semester_id is not None:
        stmt = stmt.where(ScheduleEntry.semester_id == semester_id)
    if group_id is not None:
        stmt = stmt.where(ScheduleEntry.group_id == group_id)
    return list(db.scalars(stmt).all())


@router.post("", response_model=ScheduleEntryOut, status_code=201)
def create_schedule_entry(
    payload: ScheduleEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> ScheduleEntry:
    assignment = db.get(TeachingAssignment, payload.assignment_id)
    if assignment is None:
        raise HTTPException(status_code=404, detail="Teaching assignment not found")
    assert_department_access(current_user, assignment.teacher.department_id)

    try:
        check_for_conflicts(
            db,
            semester_id=assignment.semester_id,
            day_of_week=payload.day_of_week,
            time_slot_id=payload.time_slot_id,
            room_id=payload.room_id,
            teacher_id=assignment.teacher_id,
            group_id=assignment.group_id,
        )
    except ScheduleConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    entry = ScheduleEntry(
        assignment_id=assignment.id,
        semester_id=assignment.semester_id,
        teacher_id=assignment.teacher_id,
        group_id=assignment.group_id,
        room_id=payload.room_id,
        time_slot_id=payload.time_slot_id,
        day_of_week=payload.day_of_week,
    )
    db.add(entry)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This slot is already booked") from exc
    db.refresh(entry)
    return entry


@router.patch("/{entry_id}", response_model=ScheduleEntryOut)
def update_schedule_entry(
    entry_id: int,
    payload: ScheduleEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> ScheduleEntry:
    """Moves an entry to a different day/time slot/room in place — the id (and every
    LessonSession already recorded against it) is preserved, unlike delete+recreate which
    is blocked once a lesson has been held. This is the way to reschedule a class without
    losing its attendance/grade history.
    """
    entry = db.get(ScheduleEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    assert_department_access(current_user, entry.assignment.teacher.department_id)

    new_room_id = payload.room_id if payload.room_id is not None else entry.room_id
    new_time_slot_id = payload.time_slot_id if payload.time_slot_id is not None else entry.time_slot_id
    new_day_of_week = payload.day_of_week if payload.day_of_week is not None else entry.day_of_week

    try:
        check_for_conflicts(
            db,
            semester_id=entry.semester_id,
            day_of_week=new_day_of_week,
            time_slot_id=new_time_slot_id,
            room_id=new_room_id,
            teacher_id=entry.teacher_id,
            group_id=entry.group_id,
            exclude_entry_id=entry.id,
        )
    except ScheduleConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    entry.room_id = new_room_id
    entry.time_slot_id = new_time_slot_id
    entry.day_of_week = new_day_of_week
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This slot is already booked") from exc
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_schedule_entry(
    entry_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> None:
    """With force=True, also deletes every LessonSession already held against this entry —
    and with it their attendance and grade records (cascaded via the ORM relationship) —
    permanently. Without it, a slot with any recorded lesson is left alone; use PATCH to
    move it instead if the history should be kept.
    """
    entry = db.get(ScheduleEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    assert_department_access(current_user, entry.assignment.teacher.department_id)
    if force:
        for session in db.scalars(select(LessonSession).where(LessonSession.schedule_entry_id == entry.id)):
            db.delete(session)
    db.delete(entry)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Cannot remove a schedule entry that already has lessons recorded against it"
        ) from exc
