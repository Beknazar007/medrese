from sqlalchemy import Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import DayOfWeek


class ScheduleEntry(Base):
    """One timetable slot. teacher_id/group_id/semester_id are denormalized from `assignment`
    at creation time so the DB itself can enforce the three no-double-booking rules; the
    service layer in schedule_conflict.py checks the same rules first to raise a clear error.
    """

    __tablename__ = "schedule_entries"
    __table_args__ = (
        UniqueConstraint("semester_id", "day_of_week", "time_slot_id", "room_id", name="uq_schedule_room_slot"),
        UniqueConstraint("semester_id", "day_of_week", "time_slot_id", "teacher_id", name="uq_schedule_teacher_slot"),
        UniqueConstraint("semester_id", "day_of_week", "time_slot_id", "group_id", name="uq_schedule_group_slot"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("teaching_assignments.id"), nullable=False)
    semester_id: Mapped[int] = mapped_column(ForeignKey("semesters.id"), nullable=False)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=False)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    time_slot_id: Mapped[int] = mapped_column(ForeignKey("time_slots.id"), nullable=False)
    day_of_week: Mapped[DayOfWeek] = mapped_column(Enum(DayOfWeek, name="day_of_week"), nullable=False)

    assignment: Mapped["TeachingAssignment"] = relationship(back_populates="schedule_entries")
    room: Mapped["Room"] = relationship(back_populates="schedule_entries")
    time_slot: Mapped["TimeSlot"] = relationship(back_populates="schedule_entries")
