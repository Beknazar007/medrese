from pydantic import BaseModel

from app.models.enums import GroupType


class GroupCreate(BaseModel):
    name: str
    specialty: str
    course_year: int
    department_id: int
    group_type: GroupType = GroupType.REGULAR


class GroupUpdate(BaseModel):
    name: str | None = None
    specialty: str | None = None
    course_year: int | None = None
    group_type: GroupType | None = None


class GroupOut(BaseModel):
    id: int
    name: str
    specialty: str
    course_year: int
    department_id: int
    group_type: GroupType

    model_config = {"from_attributes": True}
