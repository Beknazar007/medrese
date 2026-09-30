from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.assignment import TeachingAssignment
from app.models.attendance import AttendanceRecord
from app.models.enums import GroupType
from app.models.group import Group
from app.models.hifz import HifzExam, HifzRecord, HifzTarget
from app.models.student import Student
from app.schemas.hifz import (
    HifzExamCreate,
    HifzExamOut,
    HifzExamUpdate,
    HifzJournalGroupOut,
    HifzJournalOut,
    HifzJournalStudentOut,
    HifzRecordDetail,
    HifzRecordOut,
    HifzRecordPut,
    HifzRecordUpsert,
    HifzRosterStudentOut,
    HifzTargetBulkCreate,
    HifzTargetCreate,
    HifzTargetOut,
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


def roster_for_group_date(
    db: Session, *, group_id: int, on_date: date, session_id: int | None = None
) -> list[HifzRosterStudentOut]:
    """Pass session_id to also fill in each student's attendance for that lesson — the same
    AttendanceRecord rows the regular journal uses, so hafiz attendance counts everywhere.
    """
    students = db.scalars(
        select(Student).where(Student.group_id == group_id, Student.is_active.is_(True)).order_by(Student.full_name)
    ).all()

    records = db.scalars(
        select(HifzRecord).where(HifzRecord.student_id.in_([s.id for s in students]), HifzRecord.date == on_date)
    ).all()
    by_student_kind = {(r.student_id, r.kind.value): r for r in records}
    attendance_by_student = (
        {a.student_id: a for a in db.scalars(select(AttendanceRecord).where(AttendanceRecord.session_id == session_id))}
        if session_id is not None
        else {}
    )

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
            attendance_status=attendance_by_student[s.id].status if s.id in attendance_by_student else None,
            attendance_comment=attendance_by_student[s.id].comment if s.id in attendance_by_student else None,
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
        if _is_empty(record):
            # Nothing left in the cell — drop the row instead of keeping an all-null record.
            if current is not None:
                db.delete(current)
                del existing[key]
            continue
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


def _is_empty(record: HifzRecordUpsert) -> bool:
    return (
        record.score is None
        and record.juz is None
        and record.page_from is None
        and record.page_to is None
        and not (record.comment or "").strip()
    )


def put_record(db: Session, *, payload: HifzRecordPut) -> HifzRecord | None:
    """Upsert one gradebook cell; an all-empty payload deletes it. Returns None when deleted."""
    current = db.scalar(
        select(HifzRecord).where(
            HifzRecord.student_id == payload.student_id,
            HifzRecord.date == payload.date,
            HifzRecord.kind == payload.kind,
        )
    )
    if _is_empty(payload):
        if current is not None:
            db.delete(current)
        return None
    if current is None:
        current = HifzRecord(student_id=payload.student_id, date=payload.date, kind=payload.kind)
        db.add(current)
    current.score = payload.score
    current.juz = payload.juz
    current.page_from = payload.page_from
    current.page_to = payload.page_to if payload.page_to is not None else payload.page_from
    current.comment = (payload.comment or "").strip() or None
    return current


def accessible_hifz_group_ids(db: Session, *, teacher_id: int | None, department_ids: list[int] | None) -> list[int]:
    """Hafiz groups a user may see: a teacher's own (teacher_id), otherwise every hafiz group
    in department_ids (None = all departments, i.e. the rector)."""
    if teacher_id is not None:
        return teacher_hifz_group_ids(db, teacher_id=teacher_id)
    stmt = select(Group.id).where(Group.group_type == GroupType.HAFIZ)
    if department_ids is not None:
        stmt = stmt.where(Group.department_id.in_(department_ids))
    return list(db.scalars(stmt).all())


def with_progress(db: Session, targets: list[HifzTarget]) -> list[HifzTargetOut]:
    """Attach avg_score/graded_days. Targets link to records only logically (same student +
    kind, date inside the target's period), so deleting a target never touches any scores."""
    if not targets:
        return []
    records = db.scalars(
        select(HifzRecord).where(
            HifzRecord.student_id.in_({t.student_id for t in targets}),
            HifzRecord.date >= min(t.start_date for t in targets),
            HifzRecord.date <= max(t.end_date for t in targets),
            HifzRecord.score.is_not(None),
        )
    ).all()
    out: list[HifzTargetOut] = []
    for target in targets:
        scored = [
            r
            for r in records
            if r.student_id == target.student_id
            and r.kind == target.kind
            and target.start_date <= r.date <= target.end_date
        ]
        row = HifzTargetOut.model_validate(target)
        row.avg_score = round(sum(r.score for r in scored) / len(scored), 1) if scored else None
        row.graded_days = len({r.date for r in scored})
        out.append(row)
    return out


def journal(db: Session, *, group_ids: list[int], date_from: date, date_to: date, can_edit: bool) -> HifzJournalOut:
    """Everything the students × days gradebook needs for a period, in one round trip."""
    groups = db.scalars(select(Group).where(Group.id.in_(group_ids)).order_by(Group.name)).all()
    students = db.scalars(
        select(Student).where(Student.group_id.in_(group_ids), Student.is_active.is_(True)).order_by(Student.full_name)
    ).all()
    student_ids = [s.id for s in students]
    records = db.scalars(
        select(HifzRecord)
        .where(HifzRecord.student_id.in_(student_ids), HifzRecord.date.between(date_from, date_to))
        .order_by(HifzRecord.date, HifzRecord.student_id)
    ).all()
    exams = db.scalars(
        select(HifzExam)
        .where(HifzExam.student_id.in_(student_ids), HifzExam.date.between(date_from, date_to))
        .order_by(HifzExam.date, HifzExam.student_id)
    ).all()
    targets = db.scalars(
        select(HifzTarget)
        .where(
            HifzTarget.student_id.in_(student_ids),
            HifzTarget.end_date >= date_from,
            HifzTarget.start_date <= date_to,
        )
        .order_by(HifzTarget.end_date.desc(), HifzTarget.id.desc())
    ).all()
    return HifzJournalOut(
        date_from=date_from,
        date_to=date_to,
        can_edit=can_edit,
        groups=[HifzJournalGroupOut(id=g.id, name=g.name) for g in groups],
        students=[HifzJournalStudentOut(id=s.id, full_name=s.full_name, group_id=s.group_id) for s in students],
        records=[HifzRecordOut.model_validate(r) for r in records],
        exams=[HifzExamOut.model_validate(e) for e in exams],
        targets=with_progress(db, list(targets)),
    )


def list_targets(db: Session, *, student_ids: list[int]) -> list[HifzTarget]:
    return list(
        db.scalars(
            select(HifzTarget)
            .where(HifzTarget.student_id.in_(student_ids))
            .order_by(HifzTarget.end_date.desc(), HifzTarget.id.desc())
        ).all()
    )


def create_targets_bulk(db: Session, *, payload: HifzTargetBulkCreate) -> list[HifzTarget]:
    """All or nothing: one transaction, one row per student."""
    fields = payload.model_dump(exclude={"student_ids"})
    targets = [HifzTarget(student_id=sid, **fields) for sid in payload.student_ids]
    db.add_all(targets)
    db.commit()
    for target in targets:
        db.refresh(target)
    return targets


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
