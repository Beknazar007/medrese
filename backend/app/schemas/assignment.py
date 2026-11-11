from pydantic import BaseModel

from app.models.enums import HourType


class TeachingAssignmentCreate(BaseModel):
    teacher_id: int
    subject_id: int
    group_id: int
    semester_id: int
    hour_type: HourType


class TeachingAssignmentUpdate(BaseModel):
    """Every field optional; absent or null means "keep the current value"."""

    teacher_id: int | None = None
    subject_id: int | None = None
    group_id: int | None = None
    semester_id: int | None = None
    hour_type: HourType | None = None


class TeachingAssignmentOut(BaseModel):
    id: int
    teacher_id: int
    subject_id: int
    group_id: int
    semester_id: int
    hour_type: HourType

    model_config = {"from_attributes": True}
