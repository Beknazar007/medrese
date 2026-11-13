from datetime import date
from typing import Annotated

from pydantic import AfterValidator, BaseModel, StringConstraints, model_validator


def _not_blank(value: str) -> str:
    if not value:
        raise ValueError("Name must not be empty")
    return value


Name = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255), AfterValidator(_not_blank)]


class NonWorkingDayCreate(BaseModel):
    name: Name
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def _check_range(self) -> "NonWorkingDayCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        return self


class NonWorkingDayUpdate(BaseModel):
    # Partial: the router checks the resulting range against the stored dates.
    name: Name | None = None
    start_date: date | None = None
    end_date: date | None = None


class NonWorkingDayOut(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date

    model_config = {"from_attributes": True}
