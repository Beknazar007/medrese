from pydantic import BaseModel


class DepartmentCreate(BaseModel):
    name: str
    head_user_id: int | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = None
    head_user_id: int | None = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    head_user_id: int | None

    model_config = {"from_attributes": True}
