from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AssignmentTeacherChange(Base):
    """One replacement of the teacher of a timetabled assignment. Schedule entries only keep
    the current teacher, so monitoring needs this log to keep counting lessons that were
    *not* held before the replacement against the teacher who was responsible back then.
    """

    __tablename__ = "assignment_teacher_changes"

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("teaching_assignments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=False)
    to_teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=False)
    # From this day (Asia/Bishkek) on, to_teacher is responsible for the assignment's lessons.
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    changed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
