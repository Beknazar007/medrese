from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, Field


def _none_to_zero(v: Any) -> Any:
    # A form field left empty arrives as null; "no practice hours" means 0, and the columns are NOT NULL.
    return 0 if v is None else v


Hours = Annotated[int, BeforeValidator(_none_to_zero), Field(ge=0)]
# On PATCH an absent field means "leave as is" (dropped by exclude_unset), but an explicit null
# still means "cleared" -> 0, hence the validator sits outside the Optional.
OptionalHours = Annotated[int | None, BeforeValidator(_none_to_zero), Field(ge=0)]


class SubjectCreate(BaseModel):
    name: str
    code: str
    department_id: int
    lecture_hours: Hours = 0
    practice_hours: Hours = 0
    lab_hours: Hours = 0


class SubjectUpdate(BaseModel):
    name: str | None = None
    lecture_hours: OptionalHours = None
    practice_hours: OptionalHours = None
    lab_hours: OptionalHours = None


class SubjectOut(BaseModel):
    id: int
    name: str
    code: str
    department_id: int
    lecture_hours: int
    practice_hours: int
    lab_hours: int

    model_config = {"from_attributes": True}
