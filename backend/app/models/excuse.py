from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class StudentExcuse(Base):
    """An absence with a valid reason (illness, family matter, ...) recorded by the dean's
    office for a date range. Every lesson of the student's group inside the range gets an
    EXCUSED attendance record linked back here, which teachers can't change.
    """

    __tablename__ = "student_excuses"
    __table_args__ = (CheckConstraint("date_to >= date_from", name="ck_student_excuse_date_range"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    date_from: Mapped[date] = mapped_column(Date, nullable=False)
    date_to: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship()
    created_by: Mapped["User | None"] = relationship()
