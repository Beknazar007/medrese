from pydantic import BaseModel


class SubjectCreate(BaseModel):
    name: str
    code: str
    department_id: int
    lecture_hours: int = 0
    practice_hours: int = 0
    lab_hours: int = 0


class SubjectUpdate(BaseModel):
    name: str | None = None
    lecture_hours: int | None = None
    practice_hours: int | None = None
    lab_hours: int | None = None


class SubjectOut(BaseModel):
    id: int
    name: str
    code: str
    department_id: int
    lecture_hours: int
    practice_hours: int
    lab_hours: int

    model_config = {"from_attributes": True}
