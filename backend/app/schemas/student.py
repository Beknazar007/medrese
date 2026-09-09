from datetime import date

from pydantic import BaseModel


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
    is_active: bool = True
    photo: str | None = None


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

    model_config = {"from_attributes": True}
