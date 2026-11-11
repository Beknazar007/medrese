from datetime import date
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator


def _none_to_true(v: Any) -> Any:
    # A newly enrolled student is active unless explicitly marked otherwise; an untouched
    # switch arrives as null.
    return True if v is None else v


class StudentCreate(BaseModel):
    full_name: str
    group_id: int
    student_number: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    address: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    enrollment_date: date | None = None
    is_active: Annotated[bool, BeforeValidator(_none_to_true)] = True
    photo: str | None = None
    bio: str | None = None


class StudentUpdate(BaseModel):
    full_name: str | None = None
    group_id: int | None = None
    student_number: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    address: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    enrollment_date: date | None = None
    is_active: bool | None = None
    photo: str | None = None
    bio: str | None = None


class StudentOut(BaseModel):
    id: int
    full_name: str
    group_id: int
    student_number: str | None
    phone: str | None
    birth_date: date | None
    address: str | None
    guardian_name: str | None
    guardian_phone: str | None
    enrollment_date: date | None
    is_active: bool
    photo: str | None
    bio: str | None

    model_config = {"from_attributes": True}


class StudentRecordCounts(BaseModel):
    """What a forced delete would erase along with the student."""

    attendance: int
    grades: int
    notes: int
    hifz: int
