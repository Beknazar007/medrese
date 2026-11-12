from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel


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

    model_config = {"from_attributes": True}


class TeacherMonitoringSummaryOut(BaseModel):
    expected_lessons: int
    conducted_lessons: int
    missed_lessons: int
    late_lessons: int
    conducted_percent: int | None
    lowest_percent: list[TeacherMonitoringRowOut]
    # Deprecated: read by dashboards released before lowest_percent existed.
    top_missed: list[TeacherMonitoringRowOut]

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

    model_config = {"from_attributes": True}


class StudentAttendanceSummaryOut(BaseModel):
    present: int
    absent: int
    late: int
    excused: int
    average_score: float | None

    model_config = {"from_attributes": True}
