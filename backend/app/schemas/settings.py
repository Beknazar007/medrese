from pydantic import BaseModel, Field


class AppSettingsOut(BaseModel):
    late_threshold_minutes: int


class AppSettingsUpdate(BaseModel):
    late_threshold_minutes: int = Field(ge=0, le=60)
