from pydantic import BaseModel

from app.models.enums import UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    email: str | None
    role: UserRole
    is_active: bool
    headed_department_id: int | None = None

    model_config = {"from_attributes": True}
