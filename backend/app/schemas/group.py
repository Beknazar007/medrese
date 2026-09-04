from pydantic import BaseModel


class GroupCreate(BaseModel):
    name: str
    specialty: str
    course_year: int
    department_id: int


class GroupUpdate(BaseModel):
    name: str | None = None
    specialty: str | None = None
    course_year: int | None = None


class GroupOut(BaseModel):
    id: int
    name: str
    specialty: str
    course_year: int
    department_id: int

    model_config = {"from_attributes": True}
