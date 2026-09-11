from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    head_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), unique=True, nullable=True)

    head: Mapped["User | None"] = relationship(back_populates="headed_department", foreign_keys=[head_user_id])
    teachers: Mapped[list["TeacherProfile"]] = relationship(back_populates="department")
    subjects: Mapped[list["Subject"]] = relationship(back_populates="department")
    groups: Mapped[list["Group"]] = relationship(back_populates="department")
