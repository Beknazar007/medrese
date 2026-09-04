from pydantic import BaseModel

from app.models.enums import UserRole


class UserCreate(BaseModel):
    username: str
    password: str
    email: str | None = None
    role: UserRole
