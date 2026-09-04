from pydantic import BaseModel


class FacultyCreate(BaseModel):
    name: str


class FacultyOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}
