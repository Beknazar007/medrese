from sqlalchemy import Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import HourType


class TeachingAssignment(Base):
    """Who teaches what to whom: the join point future grading/journal will hang off of."""

    __tablename__ = "teaching_assignments"
    __table_args__ = (
        UniqueConstraint(
            "teacher_id", "subject_id", "group_id", "semester_id", "hour_type",
            name="uq_assignment_teacher_subject_group_semester_hourtype",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False)
    semester_id: Mapped[int] = mapped_column(ForeignKey("semesters.id"), nullable=False)
    hour_type: Mapped[HourType] = mapped_column(Enum(HourType, name="hour_type"), nullable=False)

    teacher: Mapped["TeacherProfile"] = relationship(back_populates="assignments")
    subject: Mapped["Subject"] = relationship(back_populates="assignments")
    group: Mapped["Group"] = relationship(back_populates="assignments")
    semester: Mapped["Semester"] = relationship(back_populates="assignments")
    schedule_entries: Mapped[list["ScheduleEntry"]] = relationship(back_populates="assignment")
