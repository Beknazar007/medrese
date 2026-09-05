from datetime import date

from sqlalchemy import Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LessonSession(Base):
    """One concrete, dated occurrence of a recurring ScheduleEntry — e.g. 'Monday period 1
    on 2026-09-08'. Attendance and grades hang off this, not off the ScheduleEntry itself,
    since a weekly slot repeats but each date's class is a separate record to mark.
    """

    __tablename__ = "lesson_sessions"
    __table_args__ = (UniqueConstraint("schedule_entry_id", "date", name="uq_session_entry_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_entry_id: Mapped[int] = mapped_column(ForeignKey("schedule_entries.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)

    schedule_entry: Mapped["ScheduleEntry"] = relationship()
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    grade_records: Mapped[list["GradeRecord"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
