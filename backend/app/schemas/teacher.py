from datetime import date

from pydantic import BaseModel


class TeacherCreate(BaseModel):
    username: str
    password: str
    email: str | None = None
    full_name: str
    department_id: int
    academic_degree: str | None = None
    phone: str | None = None
    hire_date: date | None = None
    bio: str | None = None


class TeacherUpdate(BaseModel):
    full_name: str | None = None
    department_id: int | None = None
    academic_degree: str | None = None
    phone: str | None = None
    hire_date: date | None = None
    bio: str | None = None


class TeacherOut(BaseModel):
    id: int
    user_id: int
    username: str
    department_id: int
    full_name: str
    academic_degree: str | None
    phone: str | None
    hire_date: date | None
    bio: str | None

    model_config = {"from_attributes": True}
