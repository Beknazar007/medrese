from sqlalchemy import CheckConstraint, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AppSettings(Base):
    """School-wide settings the rector can change without a programmer. Always a single row
    (id = 1); typed columns rather than key/value so the database checks the ranges."""

    __tablename__ = "app_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_app_settings_single_row"),
        CheckConstraint("late_threshold_minutes BETWEEN 0 AND 60", name="ck_app_settings_late_threshold"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    late_threshold_minutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default="15")
