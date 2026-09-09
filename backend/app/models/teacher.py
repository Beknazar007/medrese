from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TeacherProfile(Base):
    __tablename__ = "teacher_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)

    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    academic_degree: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    bio: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    # Extended profile, mainly for the rector's view.
    photo: Mapped[str | None] = mapped_column(Text, nullable=True)  # base64 data URL, resized client-side
    education: Mapped[str | None] = mapped_column(Text, nullable=True)  # where they studied
    competency: Mapped[str | None] = mapped_column(Text, nullable=True)
    teaching_experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    previous_subjects: Mapped[str | None] = mapped_column(Text, nullable=True)  # taught before joining
    can_teach: Mapped[str | None] = mapped_column(Text, nullable=True)  # subjects/areas they're qualified for

    user: Mapped["User"] = relationship(back_populates="teacher_profile")
    department: Mapped["Department"] = relationship(back_populates="teachers")
    assignments: Mapped[list["TeachingAssignment"]] = relationship(back_populates="teacher")

    @property
    def username(self) -> str:
        return self.user.username
