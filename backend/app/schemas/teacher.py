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
    photo: str | None = None
    education: str | None = None
    competency: str | None = None
    teaching_experience_years: int | None = None
    previous_subjects: str | None = None
    can_teach: str | None = None


class TeacherUpdate(BaseModel):
    full_name: str | None = None
    department_id: int | None = None
    academic_degree: str | None = None
    phone: str | None = None
    hire_date: date | None = None
    bio: str | None = None
    photo: str | None = None
    education: str | None = None
    competency: str | None = None
    teaching_experience_years: int | None = None
    previous_subjects: str | None = None
    can_teach: str | None = None


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
    photo: str | None
    education: str | None
    competency: str | None
    teaching_experience_years: int | None
    previous_subjects: str | None
    can_teach: str | None

    model_config = {"from_attributes": True}
