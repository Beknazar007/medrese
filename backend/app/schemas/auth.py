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
    must_change_password: bool
    headed_department_id: int | None = None

    model_config = {"from_attributes": True}


class MeOut(UserOut):
    # Only /auth/me carries the name: UserOut is also the /users contract, which stays unchanged.
    full_name: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
