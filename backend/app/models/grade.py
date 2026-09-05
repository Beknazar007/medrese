from sqlalchemy import CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class GradeRecord(Base):
    __tablename__ = "grade_records"
    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_grade_session_student"),
        CheckConstraint("score >= 0 AND score <= 100", name="ck_grade_score_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("lesson_sessions.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    score: Mapped[int] = mapped_column(nullable=False)

    session: Mapped["LessonSession"] = relationship(back_populates="grade_records")
    student: Mapped["Student"] = relationship(back_populates="grade_records")
