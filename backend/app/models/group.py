from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    specialty: Mapped[str] = mapped_column(String(255), nullable=False)
    course_year: Mapped[int] = mapped_column(nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)

    department: Mapped["Department"] = relationship(back_populates="groups")
    assignments: Mapped[list["TeachingAssignment"]] = relationship(back_populates="group")
    students: Mapped[list["Student"]] = relationship(back_populates="group")
