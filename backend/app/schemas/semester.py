from datetime import date
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator


def _none_to_false(v: Any) -> Any:
    # An untouched "active" switch arrives as null; a new semester must not silently take over
    # from the current active one, so null means "not active".
    return False if v is None else v


class SemesterCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_active: Annotated[bool, BeforeValidator(_none_to_false)] = False


class SemesterUpdate(BaseModel):
    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None


class SemesterOut(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
    is_active: bool

    model_config = {"from_attributes": True}
