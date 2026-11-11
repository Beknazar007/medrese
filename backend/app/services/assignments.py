from collections.abc import Sequence
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.models.assignment import TeachingAssignment
from app.models.assignment_teacher_change import AssignmentTeacherChange
from app.models.schedule import ScheduleEntry

BISHKEK_TZ = ZoneInfo("Asia/Bishkek")


class TeacherBusyError(Exception):
    """The new teacher already teaches at one or more of the assignment's timetable slots."""

    def __init__(self, slots: list[str]):
        self.slots = slots
        super().__init__(f"The new teacher already has classes at: {', '.join(slots)}")


def today_bishkek() -> date:
    return datetime.now(BISHKEK_TZ).date()


def find_teacher_conflicts(db: Session, *, assignment_id: int, semester_id: int, teacher_id: int) -> list[str]:
    """Every "<day_of_week>/<period number>" where the assignment has a lesson and the given
    teacher already teaches something else, in timetable order. Two queries regardless of
    how many entries there are."""
    own = list(db.scalars(select(ScheduleEntry).where(ScheduleEntry.assignment_id == assignment_id)).all())
    if not own:
        return []
    own_slots = {(e.day_of_week, e.time_slot_id) for e in own}
    busy = db.scalars(
        select(ScheduleEntry)
        .options(selectinload(ScheduleEntry.time_slot))
        .where(
            ScheduleEntry.semester_id == semester_id,
            ScheduleEntry.teacher_id == teacher_id,
            ScheduleEntry.assignment_id != assignment_id,
        )
    ).all()
    clashes = sorted(
        {(e.day_of_week.value, e.time_slot.order) for e in busy if (e.day_of_week, e.time_slot_id) in own_slots}
    )
    return [f"{day}/{order}" for day, order in clashes]


def replace_teacher(
    db: Session,
    *,
    assignment: TeachingAssignment,
    new_teacher_id: int,
    changed_by_user_id: int | None,
    effective_from: date | None = None,
) -> None:
    """Moves every timetable lesson of the assignment to the new teacher. Schedule entries are
    updated in place, not recreated: held lessons point at them. Already-held lessons keep their
    own teacher_id, and the logged change lets monitoring keep earlier missed lessons with the
    previous teacher. Raises TeacherBusyError (changing nothing) on a clash.
    The caller has already checked access and department rules and commits afterwards."""
    conflicts = find_teacher_conflicts(
        db, assignment_id=assignment.id, semester_id=assignment.semester_id, teacher_id=new_teacher_id
    )
    if conflicts:
        raise TeacherBusyError(conflicts)

    db.execute(
        update(ScheduleEntry).where(ScheduleEntry.assignment_id == assignment.id).values(teacher_id=new_teacher_id)
    )
    db.add(
        AssignmentTeacherChange(
            assignment_id=assignment.id,
            from_teacher_id=assignment.teacher_id,
            to_teacher_id=new_teacher_id,
            effective_from=effective_from or today_bishkek(),
            changed_by_user_id=changed_by_user_id,
        )
    )


def responsible_teacher_id(
    entry: ScheduleEntry,
    on_date: date,
    changes: Sequence[AssignmentTeacherChange],
    held_by: int | None = None,
) -> int:
    """Who answers for the entry's lesson on that date: whoever held it (`held_by`, the
    lesson session's teacher_id), if it was held; otherwise whoever was assigned on that date
    according to the replacement log (`changes` sorted by effective_from); with no later
    replacement, the current teacher."""
    if held_by is not None:
        return held_by
    for change in changes:
        if on_date < change.effective_from:
            return change.from_teacher_id
    return entry.teacher_id


def changes_by_assignment(db: Session, assignment_ids: Sequence[int]) -> dict[int, list[AssignmentTeacherChange]]:
    """Replacement logs for many assignments in one query, each sorted by effective_from."""
    result: dict[int, list[AssignmentTeacherChange]] = {}
    if not assignment_ids:
        return result
    rows = db.scalars(
        select(AssignmentTeacherChange)
        .where(AssignmentTeacherChange.assignment_id.in_(list(assignment_ids)))
        .order_by(AssignmentTeacherChange.effective_from, AssignmentTeacherChange.id)
    ).all()
    for row in rows:
        result.setdefault(row.assignment_id, []).append(row)
    return result
