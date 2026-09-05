from datetime import date

from pydantic import BaseModel, Field

from app.models.enums import AttendanceStatus


class SessionGetOrCreate(BaseModel):
    schedule_entry_id: int
    date: date


class LessonSessionOut(BaseModel):
    id: int
    schedule_entry_id: int
    date: date

    model_config = {"from_attributes": True}


class RosterStudentOut(BaseModel):
    student_id: int
    full_name: str
    student_number: str | None
    attendance_status: AttendanceStatus | None
    score: int | None


class LessonSessionDetailOut(BaseModel):
    session: LessonSessionOut
    roster: list[RosterStudentOut]


class AttendanceUpsert(BaseModel):
    student_id: int
    status: AttendanceStatus


class BulkAttendanceRequest(BaseModel):
    records: list[AttendanceUpsert]


class GradeUpsert(BaseModel):
    student_id: int
    score: int = Field(ge=0, le=100)


class BulkGradeRequest(BaseModel):
    records: list[GradeUpsert]


class StudentPerformanceRow(BaseModel):
    student_id: int
    full_name: str
    average_score: float | None
    sessions_count: int
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
