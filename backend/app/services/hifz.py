from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.assignment import TeachingAssignment
from app.models.enums import GroupType
from app.models.group import Group
from app.models.hifz import HifzExam, HifzRecord, HifzTarget
from app.models.student import Student
from app.schemas.hifz import (
    HifzExamCreate,
    HifzExamUpdate,
    HifzRecordDetail,
    HifzRecordUpsert,
    HifzRosterStudentOut,
    HifzTargetCreate,
    HifzTargetUpdate,
    validate_hifz_ranges,
)


def teacher_hifz_group_ids(db: Session, *, teacher_id: int) -> list[int]:
    """Hafiz-type groups this teacher has any TeachingAssignment for — this is the whole
    access-control mechanism for the hifz journal, reusing the existing Subjects+Assignments
    flow instead of a dedicated grant. Not semester-scoped: memorization tracking is ongoing.
    """
    stmt = (
        select(TeachingAssignment.group_id)
        .join(Group, Group.id == TeachingAssignment.group_id)
        .where(TeachingAssignment.teacher_id == teacher_id, Group.group_type == GroupType.HAFIZ)
        .distinct()
    )
    return list(db.scalars(stmt).all())


def roster_for_group_date(db: Session, *, group_id: int, on_date: date) -> list[HifzRosterStudentOut]:
    students = db.scalars(
        select(Student).where(Student.group_id == group_id, Student.is_active.is_(True)).order_by(Student.full_name)
    ).all()

    records = db.scalars(
        select(HifzRecord).where(HifzRecord.student_id.in_([s.id for s in students]), HifzRecord.date == on_date)
    ).all()
    by_student_kind = {(r.student_id, r.kind.value): r for r in records}

    def _detail(student_id: int, kind: str) -> HifzRecordDetail:
        r = by_student_kind.get((student_id, kind))
        if r is None:
            return HifzRecordDetail(score=None, juz=None, page_from=None, page_to=None, comment=None)
        return HifzRecordDetail(score=r.score, juz=r.juz, page_from=r.page_from, page_to=r.page_to, comment=r.comment)

    return [
        HifzRosterStudentOut(
            student_id=s.id,
            full_name=s.full_name,
            student_number=s.student_number,
            hifz=_detail(s.id, "HIFZ"),
            repeat=_detail(s.id, "REPEAT"),
        )
        for s in students
    ]


def upsert_records(db: Session, *, group_id: int, on_date: date, records: list[HifzRecordUpsert]) -> None:
    """Raises ValueError if any record's student isn't actually in group_id — the caller only
    proved access to that group, not to arbitrary students elsewhere in the system.
    """
    group_student_ids = set(db.scalars(select(Student.id).where(Student.group_id == group_id)).all())
    stray = sorted({r.student_id for r in records} - group_student_ids)
    if stray:
        raise ValueError(f"Student(s) {stray} are not in group {group_id}")

    existing = {
        (r.student_id, r.kind): r
        for r in db.scalars(
            select(HifzRecord).where(HifzRecord.student_id.in_(group_student_ids), HifzRecord.date == on_date)
        ).all()
    }
    for record in records:
        key = (record.student_id, record.kind)
        current = existing.get(key)
        if current is not None:
            current.score = record.score
            current.juz = record.juz
            current.page_from = record.page_from
            current.page_to = record.page_to
            current.comment = record.comment
        else:
            new_record = HifzRecord(
                student_id=record.student_id,
                date=on_date,
                kind=record.kind,
                score=record.score,
                juz=record.juz,
                page_from=record.page_from,
                page_to=record.page_to,
                comment=record.comment,
            )
            db.add(new_record)
            # Keep the in-memory map current so a duplicate (student_id, kind) later in the
            # same batch updates this row instead of attempting a second insert.
            existing[key] = new_record


def list_targets(db: Session, *, student_id: int) -> list[HifzTarget]:
    return list(
        db.scalars(
            select(HifzTarget).where(HifzTarget.student_id == student_id).order_by(HifzTarget.start_date.desc())
        ).all()
    )


def create_target(db: Session, *, payload: HifzTargetCreate) -> HifzTarget:
    target = HifzTarget(**payload.model_dump())
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


def update_target(db: Session, *, target: HifzTarget, payload: HifzTargetUpdate) -> HifzTarget:
    """Raises ValueError (via validate_hifz_ranges) if the fields being changed, merged onto
    what's already stored, would violate a range invariant — payload.model_validator only
    sees the PATCH body itself, not the persisted values a partial update leaves untouched.
    """
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(target, field, value)
    validate_hifz_ranges(
        start_date=target.start_date,
        end_date=target.end_date,
        juz_from=target.juz_from,
        juz_to=target.juz_to,
        page_from=target.page_from,
        page_to=target.page_to,
    )
    db.commit()
    db.refresh(target)
    return target


def delete_target(db: Session, *, target: HifzTarget) -> None:
    db.delete(target)
    db.commit()


def list_exams(db: Session, *, student_id: int) -> list[HifzExam]:
    return list(db.scalars(select(HifzExam).where(HifzExam.student_id == student_id).order_by(HifzExam.date.desc())).all())


def create_exam(db: Session, *, payload: HifzExamCreate) -> HifzExam:
    exam = HifzExam(**payload.model_dump())
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam


def update_exam(db: Session, *, exam: HifzExam, payload: HifzExamUpdate) -> HifzExam:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(exam, field, value)
    validate_hifz_ranges(
        start_date=None, end_date=None, juz_from=exam.juz_from, juz_to=exam.juz_to, page_from=None, page_to=None
    )
    db.commit()
    db.refresh(exam)
    return exam


def delete_exam(db: Session, *, exam: HifzExam) -> None:
    db.delete(exam)
    db.commit()
