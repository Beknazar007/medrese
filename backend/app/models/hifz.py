from datetime import date

from sqlalchemy import CheckConstraint, Date, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import HifzKind


class HifzTarget(Base):
    """A student's memorization/revision plan for a period — a juz/page range with a
    start and end date. Independent of the day-by-day HifzRecord scores.
    """

    __tablename__ = "hifz_targets"
    __table_args__ = (
        CheckConstraint("juz_to IS NULL OR juz_from IS NULL OR juz_to >= juz_from", name="ck_hifz_target_juz_range"),
        CheckConstraint(
            "page_to IS NULL OR page_from IS NULL OR page_to >= page_from", name="ck_hifz_target_page_range"
        ),
        CheckConstraint("end_date >= start_date", name="ck_hifz_target_date_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[HifzKind] = mapped_column(Enum(HifzKind, name="hifz_kind"), nullable=False)
    juz_from: Mapped[int | None] = mapped_column(Integer, nullable=True)
    juz_to: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_from: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_to: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    student: Mapped["Student"] = relationship()


class HifzRecord(Base):
    """One day's hifz (memorization) or repeat (revision) score for a student.
    Independent of HifzTarget — a teacher records daily progress directly.
    """

    __tablename__ = "hifz_records"
    __table_args__ = (
        UniqueConstraint("student_id", "date", "kind", name="uq_hifz_record_student_date_kind"),
        CheckConstraint("score IS NULL OR (score >= 0 AND score <= 100)", name="ck_hifz_record_score_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    kind: Mapped[HifzKind] = mapped_column(Enum(HifzKind, name="hifz_kind"), nullable=False)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    juz: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_from: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_to: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    student: Mapped["Student"] = relationship()


class HifzExam(Base):
    """A memorization exam — separate from daily HifzRecord scores, never averaged with them."""

    __tablename__ = "hifz_exams"
    __table_args__ = (
        CheckConstraint("score IS NULL OR (score >= 0 AND score <= 100)", name="ck_hifz_exam_score_range"),
        CheckConstraint("juz_to IS NULL OR juz_from IS NULL OR juz_to >= juz_from", name="ck_hifz_exam_juz_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    juz_from: Mapped[int | None] = mapped_column(Integer, nullable=True)
    juz_to: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    student: Mapped["Student"] = relationship()
