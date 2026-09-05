from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import NoteVisibility


class StudentNote(Base):
    """A teacher's note about a student. PRIVATE notes are visible only to their author;
    SHARED notes are also visible to the Dean of the student's department and the Rector —
    never to other teachers.
    """

    __tablename__ = "student_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    author_teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=False)
    body: Mapped[str] = mapped_column(String(2000), nullable=False)
    visibility: Mapped[NoteVisibility] = mapped_column(Enum(NoteVisibility, name="note_visibility"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="notes")
    author: Mapped["TeacherProfile"] = relationship()
