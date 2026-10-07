from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.api.v1.excuses import create_excuse, delete_excuse, update_excuse
from app.models.attendance import AttendanceRecord
from app.models.enums import AttendanceStatus, UserRole
from app.models.user import User
from app.schemas.excuse import ExcuseCreate, ExcuseUpdate
from app.schemas.journal import AttendanceUpsert
from app.services import journal as journal_service
from tests.factories import (
    make_assignment,
    make_department,
    make_group,
    make_room,
    make_schedule_entry,
    make_semester,
    make_student,
    make_subject,
    make_teacher,
    make_time_slot,
)

BISHKEK_TZ = ZoneInfo("Asia/Bishkek")
MONDAY = date(2026, 9, 7)


def _setup(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    group = make_group(db, department)
    assignment = make_assignment(db, teacher, make_subject(db, department), group, make_semester(db))
    entry = make_schedule_entry(db, assignment, make_room(db), make_time_slot(db))
    sick = make_student(db, group, full_name="Aisha")
    well = make_student(db, group, full_name="Bakyt")
    rector = User(username="rector", hashed_password="x", role=UserRole.RECTOR)
    db.add(rector)
    db.commit()
    return entry, sick, well, rector


def _open(db: Session, entry, on_date: date = MONDAY):
    session = journal_service.get_or_create_session(
        db, schedule_entry=entry, on_date=on_date, today=on_date, now=datetime.combine(on_date, datetime.min.time().replace(hour=8, minute=30), tzinfo=BISHKEK_TZ)
    )
    db.commit()
    return session


def _status(db: Session, session_id: int, student_id: int):
    record = db.query(AttendanceRecord).filter_by(session_id=session_id, student_id=student_id).one_or_none()
    return record.status if record is not None else None


def test_an_excuse_marks_lessons_opened_later_as_excused(db: Session):
    entry, sick, well, rector = _setup(db)
    create_excuse(ExcuseCreate(student_id=sick.id, date_from=MONDAY, date_to=MONDAY, reason="Ооруп калды"), db=db, current_user=rector)

    session = _open(db, entry)
    roster = {r.student_id: r for r in journal_service.roster_for_session(db, session)}

    assert roster[sick.id].attendance_status == AttendanceStatus.EXCUSED
    assert roster[sick.id].excuse_reason == "Ооруп калды"
    assert roster[well.id].attendance_status is None
    assert roster[well.id].excuse_reason is None


def test_an_excuse_entered_after_the_lesson_overrides_the_teachers_mark(db: Session):
    entry, sick, _, rector = _setup(db)
    session = _open(db, entry)
    journal_service.upsert_attendance(db, session=session, records=[AttendanceUpsert(student_id=sick.id, status=AttendanceStatus.ABSENT)])
    db.commit()

    create_excuse(ExcuseCreate(student_id=sick.id, date_from=MONDAY, date_to=MONDAY, reason="Справка"), db=db, current_user=rector)

    assert _status(db, session.id, sick.id) == AttendanceStatus.EXCUSED


def test_the_teacher_cannot_overwrite_an_excused_absence(db: Session):
    entry, sick, well, rector = _setup(db)
    create_excuse(ExcuseCreate(student_id=sick.id, date_from=MONDAY, date_to=MONDAY, reason="Справка"), db=db, current_user=rector)
    session = _open(db, entry)

    journal_service.upsert_attendance(
        db,
        session=session,
        records=[
            AttendanceUpsert(student_id=sick.id, status=AttendanceStatus.PRESENT),
            AttendanceUpsert(student_id=well.id, status=AttendanceStatus.PRESENT),
        ],
    )
    db.commit()

    assert _status(db, session.id, sick.id) == AttendanceStatus.EXCUSED
    assert _status(db, session.id, well.id) == AttendanceStatus.PRESENT


def test_deleting_or_shrinking_an_excuse_unmarks_the_lessons_it_no_longer_covers(db: Session):
    entry, sick, _, rector = _setup(db)
    excuse = create_excuse(
        ExcuseCreate(student_id=sick.id, date_from=MONDAY, date_to=date(2026, 9, 14), reason="Справка"), db=db, current_user=rector
    )
    first = _open(db, entry, MONDAY)
    second = _open(db, entry, date(2026, 9, 14))
    assert _status(db, first.id, sick.id) == AttendanceStatus.EXCUSED
    assert _status(db, second.id, sick.id) == AttendanceStatus.EXCUSED

    update_excuse(excuse.id, ExcuseUpdate(date_to=date(2026, 9, 10)), db=db, current_user=rector)
    assert _status(db, first.id, sick.id) == AttendanceStatus.EXCUSED
    assert _status(db, second.id, sick.id) is None

    delete_excuse(excuse.id, db=db, current_user=rector)
    assert _status(db, first.id, sick.id) is None
