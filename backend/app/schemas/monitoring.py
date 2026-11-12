from datetime import date, datetime
from enum import Enum

from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field

from app.models.enums import LessonMarkKind


class SessionStatus(str, Enum):
    """What happened to one timetabled lesson, as monitoring sees it."""

    CONDUCTED = "CONDUCTED"
    CONDUCTED_BY_MARK = "CONDUCTED_BY_MARK"
    MISSED = "MISSED"
    EXCUSED = "EXCUSED"
    CANCELLED = "CANCELLED"


class TeacherMonitoringRowOut(BaseModel):
    teacher_id: int
    full_name: str
    department_id: int
    expected_lessons: int
    conducted_lessons: int
    missed_lessons: int
    late_lessons: int
    conducted_percent: int | None
    attention_lessons: int

    model_config = {"from_attributes": True}


class TeacherMonitoringSummaryOut(BaseModel):
    expected_lessons: int
    conducted_lessons: int
    missed_lessons: int
    late_lessons: int
    conducted_percent: int | None
    attention_lessons: int
    lowest_percent: list[TeacherMonitoringRowOut]
    # Deprecated: read by dashboards released before lowest_percent existed.
    top_missed: list[TeacherMonitoringRowOut]

    model_config = {"from_attributes": True}


def _blank_to_none(value: object) -> object:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class LessonMarkUpsert(BaseModel):
    schedule_entry_id: int
    date: date
    kind: LessonMarkKind
    comment: Annotated[str | None, BeforeValidator(_blank_to_none), Field(max_length=500)] = None


class LessonMarkOut(BaseModel):
    id: int
    schedule_entry_id: int
    date: date
    kind: LessonMarkKind
    comment: str | None
    marked_by: str | None
    marked_at: datetime

    model_config = {"from_attributes": True}


class TeacherSessionLogRowOut(BaseModel):
    date: date
    schedule_entry_id: int
    subject_name: str
    group_name: str
    status: SessionStatus
    conducted: bool
    checked_in_at: datetime | None
    checked_out_at: datetime | None
    late: bool
    mark: LessonMarkOut | None
    can_mark: bool
    no_student_marks: bool
    early_finish: bool

    model_config = {"from_attributes": True}


class StudentAttendanceSummaryOut(BaseModel):
    present: int
    absent: int
    late: int
    excused: int
    average_score: float | None

    model_config = {"from_attributes": True}
