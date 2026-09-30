from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import accessible_department_ids, assert_department_access, get_current_user, require_role
from app.db.session import get_db
from app.models.enums import GroupType, UserRole
from app.models.group import Group
from app.models.hifz import HifzExam, HifzTarget
from app.models.lesson_session import LessonSession
from app.models.schedule import ScheduleEntry
from app.models.student import Student
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.schemas.group import GroupOut
from app.schemas.hifz import (
    HifzExamCreate,
    HifzExamOut,
    HifzExamUpdate,
    HifzJournalOut,
    HifzRecordOut,
    HifzRecordPut,
    HifzRecordsPutRequest,
    HifzRosterStudentOut,
    HifzSessionDetailOut,
    HifzTargetBulkCreate,
    HifzTargetCreate,
    HifzTargetOut,
    HifzTargetUpdate,
)
from app.schemas.journal import BulkAttendanceRequest, LessonSessionOut, SessionGetOrCreate
from app.services import hifz as hifz_service
from app.services import journal as journal_service

router = APIRouter(prefix="/hifz", tags=["hifz"])


def _get_own_teacher(db: Session, current_user: User) -> TeacherProfile:
    teacher = db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == current_user.id))
    if teacher is None:
        raise HTTPException(status_code=403, detail="This account has no teacher profile")
    return teacher


def _assert_can_access_group(db: Session, current_user: User, group: Group) -> None:
    if current_user.role == UserRole.TEACHER:
        teacher = _get_own_teacher(db, current_user)
        if group.id not in hifz_service.teacher_hifz_group_ids(db, teacher_id=teacher.id):
            raise HTTPException(status_code=403, detail="You do not teach this hafiz group")
    else:
        assert_department_access(current_user, group.department_id)


def _assert_can_access_student(db: Session, current_user: User, student: Student) -> None:
    # Checked for every role, not just TEACHER (whose teacher_hifz_group_ids already implies
    # this) — otherwise a RECTOR/DEAN could create hifz targets/exams for a student in a
    # REGULAR group, which would never surface in any hafiz roster or group listing.
    if student.group.group_type != GroupType.HAFIZ:
        raise HTTPException(status_code=400, detail="This student is not in a hafiz group")

    if current_user.role == UserRole.TEACHER:
        teacher = _get_own_teacher(db, current_user)
        if student.group_id not in hifz_service.teacher_hifz_group_ids(db, teacher_id=teacher.id):
            raise HTTPException(status_code=403, detail="You do not teach this student's hafiz group")
    else:
        assert_department_access(current_user, student.group.department_id)


def _accessible_group_ids(db: Session, current_user: User) -> list[int]:
    if current_user.role == UserRole.TEACHER:
        return hifz_service.accessible_hifz_group_ids(
            db, teacher_id=_get_own_teacher(db, current_user).id, department_ids=None
        )
    dept_ids = accessible_department_ids(current_user)
    return hifz_service.accessible_hifz_group_ids(
        db, teacher_id=None, department_ids=None if dept_ids is None else list(dept_ids)
    )


def _get_student_or_404(db: Session, student_id: int) -> Student:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


def _assert_can_access_hifz_entry(db: Session, current_user: User, entry: ScheduleEntry) -> None:
    if entry.assignment.group.group_type != GroupType.HAFIZ:
        raise HTTPException(status_code=400, detail="This schedule entry is not a hafiz class")
    if current_user.role == UserRole.TEACHER:
        teacher = _get_own_teacher(db, current_user)
        if entry.assignment.teacher_id != teacher.id:
            raise HTTPException(status_code=403, detail="You do not teach this class")
    else:
        assert_department_access(current_user, entry.assignment.teacher.department_id)


@router.post("/sessions", response_model=HifzSessionDetailOut)
def get_or_create_hifz_session(
    payload: SessionGetOrCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> HifzSessionDetailOut:
    entry = db.get(ScheduleEntry, payload.schedule_entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    _assert_can_access_hifz_entry(db, current_user, entry)

    try:
        session = journal_service.get_or_create_session(db, schedule_entry=entry, on_date=payload.date)
    except journal_service.SessionDateNotOpenable as exc:
        raise HTTPException(status_code=400, detail="A lesson can only be opened during its scheduled date and time") from exc
    db.commit()
    db.refresh(session)
    roster = hifz_service.roster_for_group_date(
        db, group_id=entry.group_id, on_date=payload.date, session_id=session.id
    )
    return HifzSessionDetailOut(session=LessonSessionOut.model_validate(session), roster=roster)


@router.put("/sessions/{session_id}/attendance", response_model=HifzSessionDetailOut)
def put_hifz_attendance(
    session_id: int,
    payload: BulkAttendanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> HifzSessionDetailOut:
    session = db.get(LessonSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    entry = session.schedule_entry
    _assert_can_access_hifz_entry(db, current_user, entry)

    group_student_ids = set(db.scalars(select(Student.id).where(Student.group_id == entry.group_id)).all())
    stray = sorted({r.student_id for r in payload.records} - group_student_ids)
    if stray:
        raise HTTPException(status_code=400, detail=f"Student(s) {stray} are not in group {entry.group_id}")

    journal_service.upsert_attendance(db, session=session, records=payload.records)
    db.commit()
    roster = hifz_service.roster_for_group_date(db, group_id=entry.group_id, on_date=session.date, session_id=session.id)
    return HifzSessionDetailOut(session=LessonSessionOut.model_validate(session), roster=roster)


@router.put("/sessions/{session_id}/check-out", response_model=LessonSessionOut)
def check_out_hifz_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> LessonSession:
    session = db.get(LessonSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    _assert_can_access_hifz_entry(db, current_user, session.schedule_entry)

    journal_service.check_out_session(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/groups", response_model=list[GroupOut])
def list_hifz_groups(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[Group]:
    if current_user.role == UserRole.TEACHER:
        teacher = _get_own_teacher(db, current_user)
        group_ids = hifz_service.teacher_hifz_group_ids(db, teacher_id=teacher.id)
        if not group_ids:
            return []
        return list(db.scalars(select(Group).where(Group.id.in_(group_ids)).order_by(Group.name)).all())

    dept_ids = accessible_department_ids(current_user)
    stmt = select(Group).where(Group.group_type == GroupType.HAFIZ)
    if dept_ids is not None:
        stmt = stmt.where(Group.department_id.in_(dept_ids))
    return list(db.scalars(stmt.order_by(Group.name)).all())


@router.get("/roster", response_model=list[HifzRosterStudentOut])
def get_roster(
    group_id: int,
    date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[HifzRosterStudentOut]:
    group = db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.group_type != GroupType.HAFIZ:
        raise HTTPException(status_code=400, detail="This group is not a hafiz group")
    _assert_can_access_group(db, current_user, group)

    return hifz_service.roster_for_group_date(db, group_id=group_id, on_date=date)


@router.put("/records", response_model=list[HifzRosterStudentOut])
def put_records(
    payload: HifzRecordsPutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> list[HifzRosterStudentOut]:
    group = db.get(Group, payload.group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.group_type != GroupType.HAFIZ:
        raise HTTPException(status_code=400, detail="This group is not a hafiz group")
    _assert_can_access_group(db, current_user, group)

    try:
        hifz_service.upsert_records(db, group_id=payload.group_id, on_date=payload.date, records=payload.records)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This roster was just updated elsewhere — reload and retry") from exc

    return hifz_service.roster_for_group_date(db, group_id=payload.group_id, on_date=payload.date)


@router.get("/journal", response_model=HifzJournalOut)
def get_journal(
    date_from: date,
    date_to: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HifzJournalOut:
    """Students × days gradebook for every hafiz group the user can see. Rector/dean read it;
    only the group's own teacher edits (can_edit)."""
    if date_to < date_from:
        raise HTTPException(status_code=400, detail="The end of the period is before its start")
    if (date_to - date_from).days > 400:
        raise HTTPException(status_code=400, detail="The period cannot be longer than 400 days")
    return hifz_service.journal(
        db,
        group_ids=_accessible_group_ids(db, current_user),
        date_from=date_from,
        date_to=date_to,
        can_edit=current_user.role == UserRole.TEACHER,
    )


@router.put("/record", response_model=HifzRecordOut | None)
def put_record(
    payload: HifzRecordPut,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> HifzRecordOut | None:
    """One gradebook cell, for any day — unlike attendance, hifz marks aren't tied to the
    lesson's time window. Returns null when an all-empty payload deleted the record."""
    student = _get_student_or_404(db, payload.student_id)
    _assert_can_access_student(db, current_user, student)
    record = hifz_service.put_record(db, payload=payload)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This roster was just updated elsewhere — reload and retry") from exc
    if record is None:
        return None
    db.refresh(record)
    return HifzRecordOut.model_validate(record)


@router.get("/targets", response_model=list[HifzTargetOut])
def list_targets(
    student_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[HifzTargetOut]:
    """One student's targets, or (no student_id) every target across the user's hafiz groups."""
    if student_id is not None:
        student = _get_student_or_404(db, student_id)
        _assert_can_access_student(db, current_user, student)
        student_ids = [student_id]
    else:
        group_ids = _accessible_group_ids(db, current_user)
        student_ids = list(db.scalars(select(Student.id).where(Student.group_id.in_(group_ids))).all())
    return hifz_service.with_progress(db, hifz_service.list_targets(db, student_ids=student_ids))


@router.post("/targets/bulk", response_model=list[HifzTargetOut], status_code=201)
def create_targets_bulk(
    payload: HifzTargetBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> list[HifzTargetOut]:
    students = db.scalars(select(Student).where(Student.id.in_(payload.student_ids))).all()
    if len(students) != len(payload.student_ids):
        raise HTTPException(status_code=404, detail="Student not found")
    for student in students:
        _assert_can_access_student(db, current_user, student)
    return hifz_service.with_progress(db, hifz_service.create_targets_bulk(db, payload=payload))


@router.post("/targets", response_model=HifzTargetOut, status_code=201)
def create_target(
    payload: HifzTargetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> HifzTarget:
    student = db.get(Student, payload.student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    _assert_can_access_student(db, current_user, student)
    return hifz_service.create_target(db, payload=payload)


@router.patch("/targets/{target_id}", response_model=HifzTargetOut)
def update_target(
    target_id: int,
    payload: HifzTargetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> HifzTarget:
    target = db.get(HifzTarget, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    student = db.get(Student, target.student_id)
    _assert_can_access_student(db, current_user, student)
    try:
        return hifz_service.update_target(db, target=target, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/targets/{target_id}", status_code=204)
def delete_target(
    target_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> None:
    target = db.get(HifzTarget, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    student = db.get(Student, target.student_id)
    _assert_can_access_student(db, current_user, student)
    hifz_service.delete_target(db, target=target)


@router.get("/exams", response_model=list[HifzExamOut])
def list_exams(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[HifzExam]:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    _assert_can_access_student(db, current_user, student)
    return hifz_service.list_exams(db, student_id=student_id)


@router.post("/exams", response_model=HifzExamOut, status_code=201)
def create_exam(
    payload: HifzExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> HifzExam:
    student = db.get(Student, payload.student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    _assert_can_access_student(db, current_user, student)
    return hifz_service.create_exam(db, payload=payload)


@router.patch("/exams/{exam_id}", response_model=HifzExamOut)
def update_exam(
    exam_id: int,
    payload: HifzExamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> HifzExam:
    exam = db.get(HifzExam, exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    student = db.get(Student, exam.student_id)
    _assert_can_access_student(db, current_user, student)
    try:
        return hifz_service.update_exam(db, exam=exam, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/exams/{exam_id}", status_code=204)
def delete_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER)),
) -> None:
    exam = db.get(HifzExam, exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    student = db.get(Student, exam.student_id)
    _assert_can_access_student(db, current_user, student)
    hifz_service.delete_exam(db, exam=exam)
