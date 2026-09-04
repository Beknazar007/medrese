from datetime import time

from pydantic import BaseModel


class TimeSlotCreate(BaseModel):
    order: int
    start_time: time
    end_time: time


class TimeSlotUpdate(BaseModel):
    order: int | None = None
    start_time: time | None = None
    end_time: time | None = None


class TimeSlotOut(BaseModel):
    id: int
    order: int
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}
