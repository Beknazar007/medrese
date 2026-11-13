from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import LessonMarkKind


class LessonMark(Base):
    """The rector's or dean's reason on a lesson that was never opened: held anyway, excused
    or cancelled. Deliberately not a LessonSession — a mark must not create attendance,
    grades or a lesson in a student's history. The responsible teacher isn't stored: it is
    worked out from the replacement log exactly as for a missed lesson."""

    __tablename__ = "lesson_marks"
    __table_args__ = (UniqueConstraint("schedule_entry_id", "date", name="uq_lesson_mark_entry_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_entry_id: Mapped[int] = mapped_column(
        ForeignKey("schedule_entries.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    kind: Mapped[LessonMarkKind] = mapped_column(Enum(LessonMarkKind, name="lesson_mark_kind"), nullable=False)
    comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Who set the current reason and when — changing the reason overwrites both.
    marked_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    marked_by: Mapped["User | None"] = relationship()
