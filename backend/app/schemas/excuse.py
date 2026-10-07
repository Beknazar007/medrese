from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator


class ExcuseCreate(BaseModel):
    student_id: int
    date_from: date
    date_to: date
    reason: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def _check(self) -> "ExcuseCreate":
        if self.date_to < self.date_from:
            raise ValueError("The end date is before the start date")
        return self


class ExcuseUpdate(BaseModel):
    date_from: date | None = None
    date_to: date | None = None
    reason: str | None = Field(None, min_length=1, max_length=500)


class ExcuseOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    group_id: int
    date_from: date
    date_to: date
    reason: str
    created_by: str | None
    created_at: datetime
