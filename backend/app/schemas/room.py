from pydantic import BaseModel


class RoomCreate(BaseModel):
    name: str
    building: str
    capacity: int | None = None


class RoomUpdate(BaseModel):
    name: str | None = None
    building: str | None = None
    capacity: int | None = None


class RoomOut(BaseModel):
    id: int
    name: str
    building: str
    capacity: int | None

    model_config = {"from_attributes": True}
