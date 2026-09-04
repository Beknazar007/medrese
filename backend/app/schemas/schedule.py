from pydantic import BaseModel

from app.models.enums import DayOfWeek


class ScheduleEntryCreate(BaseModel):
    assignment_id: int
    room_id: int
    time_slot_id: int
    day_of_week: DayOfWeek


class ScheduleEntryOut(BaseModel):
    id: int
    assignment_id: int
    semester_id: int
    teacher_id: int
    group_id: int
    room_id: int
    time_slot_id: int
    day_of_week: DayOfWeek

    model_config = {"from_attributes": True}
