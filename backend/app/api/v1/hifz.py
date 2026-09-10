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
from app.models.student import Student
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.schemas.group import GroupOut
from app.schemas.hifz import (
    HifzExamCreate,
    HifzExamOut,
    HifzExamUpdate,
    HifzRecordsPutRequest,
    HifzRosterStudentOut,
    HifzTargetCreate,
    HifzTargetOut,
    HifzTargetUpdate,
)
from app.services import hifz as hifz_service

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


@router.get("/targets", response_model=list[HifzTargetOut])
def list_targets(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[HifzTarget]:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    _assert_can_access_student(db, current_user, student)
    return hifz_service.list_targets(db, student_id=student_id)


@router.post("/targets", response_model=HifzTargetOut, status_code=201)
def create_target(
    payload: HifzTargetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
) -> None:
    exam = db.get(HifzExam, exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    student = db.get(Student, exam.student_id)
    _assert_can_access_student(db, current_user, student)
    hifz_service.delete_exam(db, exam=exam)
