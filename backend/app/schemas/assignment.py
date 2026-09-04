from pydantic import BaseModel

from app.models.enums import HourType


class TeachingAssignmentCreate(BaseModel):
    teacher_id: int
    subject_id: int
    group_id: int
    semester_id: int
    hour_type: HourType


class TeachingAssignmentOut(BaseModel):
    id: int
    teacher_id: int
    subject_id: int
    group_id: int
    semester_id: int
    hour_type: HourType

    model_config = {"from_attributes": True}
