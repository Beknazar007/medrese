from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)

    lecture_hours: Mapped[int] = mapped_column(default=0, nullable=False)
    practice_hours: Mapped[int] = mapped_column(default=0, nullable=False)
    lab_hours: Mapped[int] = mapped_column(default=0, nullable=False)

    department: Mapped["Department"] = relationship(back_populates="subjects")
    assignments: Mapped[list["TeachingAssignment"]] = relationship(back_populates="subject")
