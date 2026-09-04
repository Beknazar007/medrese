from datetime import time

from sqlalchemy import Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TimeSlot(Base):
    """A fixed daily period, e.g. period 1 = 08:00-08:50, shared across all days/rooms."""

    __tablename__ = "time_slots"

    id: Mapped[int] = mapped_column(primary_key=True)
    order: Mapped[int] = mapped_column(unique=True, nullable=False)  # 1st period, 2nd period, ...
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    schedule_entries: Mapped[list["ScheduleEntry"]] = relationship(back_populates="time_slot")
