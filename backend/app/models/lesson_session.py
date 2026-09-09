from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LessonSession(Base):
    """One concrete, dated occurrence of a recurring ScheduleEntry — e.g. 'Monday period 1
    on 2026-09-08'. Attendance and grades hang off this, not off the ScheduleEntry itself,
    since a weekly slot repeats but each date's class is a separate record to mark. The row's
    mere existence is what "this lesson was held" means elsewhere in the app (student history,
    teacher monitoring) — teacher_checked_in_at/out_at are the finer-grained arrival/departure
    timestamps layered on top, set when the teacher opens the class and clicks "finish".
    """

    __tablename__ = "lesson_sessions"
    __table_args__ = (UniqueConstraint("schedule_entry_id", "date", name="uq_session_entry_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_entry_id: Mapped[int] = mapped_column(ForeignKey("schedule_entries.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    teacher_checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    teacher_checked_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    schedule_entry: Mapped["ScheduleEntry"] = relationship()
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    grade_records: Mapped[list["GradeRecord"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
