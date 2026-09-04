import pytest
from sqlalchemy.orm import Session

from app.models.enums import DayOfWeek
from app.models.schedule import ScheduleEntry
from app.services.schedule_conflict import ScheduleConflictError, check_for_conflicts
from tests.factories import (
    make_assignment,
    make_department,
    make_group,
    make_room,
    make_semester,
    make_subject,
    make_teacher,
    make_time_slot,
)


def _place(db: Session, *, semester, teacher, group, room, slot, day=DayOfWeek.MONDAY) -> ScheduleEntry:
    entry = ScheduleEntry(
        assignment_id=1,  # not exercised by conflict checks directly
        semester_id=semester.id,
        teacher_id=teacher.id,
        group_id=group.id,
        room_id=room.id,
        time_slot_id=slot.id,
        day_of_week=day,
    )
    db.add(entry)
    db.flush()
    return entry


def test_no_conflict_for_first_booking(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    group = make_group(db, department)
    semester = make_semester(db)
    room = make_room(db)
    slot = make_time_slot(db)

    # Should not raise.
    check_for_conflicts(
        db,
        semester_id=semester.id,
        day_of_week=DayOfWeek.MONDAY,
        time_slot_id=slot.id,
        room_id=room.id,
        teacher_id=teacher.id,
        group_id=group.id,
    )


def test_teacher_double_booking_is_rejected(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    group_a = make_group(db, department, name="G-A")
    group_b = make_group(db, department, name="G-B")
    semester = make_semester(db)
    room_a = make_room(db, name="A")
    room_b = make_room(db, name="B")
    slot = make_time_slot(db)

    _place(db, semester=semester, teacher=teacher, group=group_a, room=room_a, slot=slot)

    with pytest.raises(ScheduleConflictError, match="teacher"):
        check_for_conflicts(
            db,
            semester_id=semester.id,
            day_of_week=DayOfWeek.MONDAY,
            time_slot_id=slot.id,
            room_id=room_b,  # different room
            teacher_id=teacher.id,  # same teacher
            group_id=group_b.id,  # different group
        )


def test_room_double_booking_is_rejected(db: Session):
    department = make_department(db)
    teacher_a = make_teacher(db, department, username="t-a")
    teacher_b = make_teacher(db, department, username="t-b")
    group_a = make_group(db, department, name="G-A")
    group_b = make_group(db, department, name="G-B")
    semester = make_semester(db)
    room = make_room(db)
    slot = make_time_slot(db)

    _place(db, semester=semester, teacher=teacher_a, group=group_a, room=room, slot=slot)

    with pytest.raises(ScheduleConflictError, match="room"):
        check_for_conflicts(
            db,
            semester_id=semester.id,
            day_of_week=DayOfWeek.MONDAY,
            time_slot_id=slot.id,
            room_id=room.id,  # same room
            teacher_id=teacher_b.id,
            group_id=group_b.id,
        )


def test_group_double_booking_is_rejected(db: Session):
    department = make_department(db)
    teacher_a = make_teacher(db, department, username="t-a")
    teacher_b = make_teacher(db, department, username="t-b")
    group = make_group(db, department)
    semester = make_semester(db)
    room_a = make_room(db, name="A")
    room_b = make_room(db, name="B")
    slot = make_time_slot(db)

    _place(db, semester=semester, teacher=teacher_a, group=group, room=room_a, slot=slot)

    with pytest.raises(ScheduleConflictError, match="group"):
        check_for_conflicts(
            db,
            semester_id=semester.id,
            day_of_week=DayOfWeek.MONDAY,
            time_slot_id=slot.id,
            room_id=room_b.id,
            teacher_id=teacher_b.id,
            group_id=group.id,  # same group
        )


def test_same_teacher_different_day_is_allowed(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    group = make_group(db, department)
    semester = make_semester(db)
    room = make_room(db)
    slot = make_time_slot(db)

    _place(db, semester=semester, teacher=teacher, group=group, room=room, slot=slot, day=DayOfWeek.MONDAY)

    # Different day, same teacher/room/group/slot — should not raise.
    check_for_conflicts(
        db,
        semester_id=semester.id,
        day_of_week=DayOfWeek.TUESDAY,
        time_slot_id=slot.id,
        room_id=room.id,
        teacher_id=teacher.id,
        group_id=group.id,
    )


def test_excluding_current_entry_allows_updating_it_in_place(db: Session):
    department = make_department(db)
    teacher = make_teacher(db, department)
    group = make_group(db, department)
    semester = make_semester(db)
    room = make_room(db)
    slot = make_time_slot(db)

    entry = _place(db, semester=semester, teacher=teacher, group=group, room=room, slot=slot)

    # Re-checking the same entry against itself should not conflict when excluded.
    check_for_conflicts(
        db,
        semester_id=semester.id,
        day_of_week=DayOfWeek.MONDAY,
        time_slot_id=slot.id,
        room_id=room.id,
        teacher_id=teacher.id,
        group_id=group.id,
        exclude_entry_id=entry.id,
    )
