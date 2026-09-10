from datetime import date as DateType

from pydantic import BaseModel, Field, model_validator

from app.models.enums import HifzKind


def validate_hifz_ranges(
    *,
    start_date: DateType | None,
    end_date: DateType | None,
    juz_from: int | None,
    juz_to: int | None,
    page_from: int | None,
    page_to: int | None,
) -> None:
    if start_date is not None and end_date is not None:
        if end_date < start_date:
            raise ValueError("end_date must be on or after start_date")
        if (end_date - start_date).days > 400:
            raise ValueError("Target period cannot exceed 400 days")
    if juz_from is not None and juz_to is not None and juz_to < juz_from:
        raise ValueError("juz_to must be >= juz_from")
    if page_from is not None and page_to is not None and page_to < page_from:
        raise ValueError("page_to must be >= page_from")


class HifzTargetCreate(BaseModel):
    student_id: int
    kind: HifzKind
    juz_from: int | None = Field(None, ge=1, le=30)
    juz_to: int | None = Field(None, ge=1, le=30)
    page_from: int | None = Field(None, ge=1, le=604)
    page_to: int | None = Field(None, ge=1, le=604)
    start_date: DateType
    end_date: DateType
    note: str | None = None

    @model_validator(mode="after")
    def _check(self) -> "HifzTargetCreate":
        validate_hifz_ranges(
            start_date=self.start_date,
            end_date=self.end_date,
            juz_from=self.juz_from,
            juz_to=self.juz_to,
            page_from=self.page_from,
            page_to=self.page_to,
        )
        return self


class HifzTargetUpdate(BaseModel):
    kind: HifzKind | None = None
    juz_from: int | None = Field(None, ge=1, le=30)
    juz_to: int | None = Field(None, ge=1, le=30)
    page_from: int | None = Field(None, ge=1, le=604)
    page_to: int | None = Field(None, ge=1, le=604)
    start_date: DateType | None = None
    end_date: DateType | None = None
    note: str | None = None

    @model_validator(mode="after")
    def _check(self) -> "HifzTargetUpdate":
        validate_hifz_ranges(
            start_date=self.start_date,
            end_date=self.end_date,
            juz_from=self.juz_from,
            juz_to=self.juz_to,
            page_from=self.page_from,
            page_to=self.page_to,
        )
        return self


class HifzTargetOut(BaseModel):
    id: int
    student_id: int
    kind: HifzKind
    juz_from: int | None
    juz_to: int | None
    page_from: int | None
    page_to: int | None
    start_date: DateType
    end_date: DateType
    note: str | None

    model_config = {"from_attributes": True}


class HifzExamCreate(BaseModel):
    student_id: int
    date: DateType
    title: str
    juz_from: int | None = Field(None, ge=1, le=30)
    juz_to: int | None = Field(None, ge=1, le=30)
    score: int | None = Field(None, ge=0, le=100)
    comment: str | None = None

    @model_validator(mode="after")
    def _check(self) -> "HifzExamCreate":
        validate_hifz_ranges(
            start_date=None, end_date=None, juz_from=self.juz_from, juz_to=self.juz_to, page_from=None, page_to=None
        )
        return self


class HifzExamUpdate(BaseModel):
    date: DateType | None = None
    title: str | None = None
    juz_from: int | None = Field(None, ge=1, le=30)
    juz_to: int | None = Field(None, ge=1, le=30)
    score: int | None = Field(None, ge=0, le=100)
    comment: str | None = None

    @model_validator(mode="after")
    def _check(self) -> "HifzExamUpdate":
        validate_hifz_ranges(
            start_date=None, end_date=None, juz_from=self.juz_from, juz_to=self.juz_to, page_from=None, page_to=None
        )
        return self


class HifzExamOut(BaseModel):
    id: int
    student_id: int
    date: DateType
    title: str
    juz_from: int | None
    juz_to: int | None
    score: int | None
    comment: str | None

    model_config = {"from_attributes": True}


class HifzRecordUpsert(BaseModel):
    student_id: int
    kind: HifzKind
    score: int | None = Field(None, ge=0, le=100)
    juz: int | None = Field(None, ge=1, le=30)
    page_from: int | None = Field(None, ge=1, le=604)
    page_to: int | None = Field(None, ge=1, le=604)
    comment: str | None = None

    @model_validator(mode="after")
    def _check(self) -> "HifzRecordUpsert":
        validate_hifz_ranges(
            start_date=None, end_date=None, juz_from=None, juz_to=None, page_from=self.page_from, page_to=self.page_to
        )
        return self


class HifzRecordsPutRequest(BaseModel):
    group_id: int
    date: DateType
    records: list[HifzRecordUpsert]


class HifzRecordDetail(BaseModel):
    score: int | None
    juz: int | None
    page_from: int | None
    page_to: int | None
    comment: str | None


class HifzRosterStudentOut(BaseModel):
    student_id: int
    full_name: str
    student_number: str | None
    hifz: HifzRecordDetail
    repeat: HifzRecordDetail
