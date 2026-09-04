from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import DayOfWeek
from app.models.schedule import ScheduleEntry


class ScheduleConflictError(Exception):
    """Raised when a schedule entry would double-book a teacher, room, or group."""


def check_for_conflicts(
    db: Session,
    *,
    semester_id: int,
    day_of_week: DayOfWeek,
    time_slot_id: int,
    room_id: int,
    teacher_id: int,
    group_id: int,
    exclude_entry_id: int | None = None,
) -> None:
    """Enforces the three no-double-booking rules at the same day+timeslot within a semester:
    a teacher, a room, and a group can each only be in one place at once. Raises
    ScheduleConflictError with a human-readable reason on the first violation found.
    Called before insert/update; the matching DB unique constraints on ScheduleEntry are
    the last-resort backstop against race conditions.
    """
    base_stmt = select(ScheduleEntry).where(
        ScheduleEntry.semester_id == semester_id,
        ScheduleEntry.day_of_week == day_of_week,
        ScheduleEntry.time_slot_id == time_slot_id,
    )
    if exclude_entry_id is not None:
        base_stmt = base_stmt.where(ScheduleEntry.id != exclude_entry_id)

    if db.scalar(base_stmt.where(ScheduleEntry.teacher_id == teacher_id).limit(1)) is not None:
        raise ScheduleConflictError("This teacher already has a class at that day and time slot")

    if db.scalar(base_stmt.where(ScheduleEntry.room_id == room_id).limit(1)) is not None:
        raise ScheduleConflictError("This room is already booked at that day and time slot")

    if db.scalar(base_stmt.where(ScheduleEntry.group_id == group_id).limit(1)) is not None:
        raise ScheduleConflictError("This group already has a class at that day and time slot")
