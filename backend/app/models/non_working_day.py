from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NonWorkingDay(Base):
    """A holiday or a vacation for the whole madrasa: lessons that weren't opened on these
    dates aren't expected and don't count as missed. Overlapping ranges are allowed — a day is
    simply non-working if any range covers it."""

    __tablename__ = "non_working_days"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="ck_non_working_day_range"),
        Index("ix_non_working_days_start_end", "start_date", "end_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
