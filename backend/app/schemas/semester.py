from datetime import date

from pydantic import BaseModel


class SemesterCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_active: bool = False


class SemesterUpdate(BaseModel):
    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None


class SemesterOut(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
    is_active: bool

    model_config = {"from_attributes": True}
