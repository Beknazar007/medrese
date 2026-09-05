from collections.abc import Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None or "sub" not in payload:
        raise credentials_error

    user = db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise credentials_error
    return user


def require_role(*allowed_roles: UserRole):
    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role {current_user.role.value} is not permitted to perform this action",
            )
        return current_user

    return _dependency


def assert_department_access(current_user: User, department_id: int) -> None:
    """RECTOR may act on any department; DEAN only on the department they head."""
    if current_user.role == UserRole.RECTOR:
        return
    if current_user.role == UserRole.DEAN:
        headed = current_user.headed_department
        if headed is not None and headed.id == department_id:
            return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this department",
    )


def accessible_department_ids(current_user: User) -> Iterable[int] | None:
    """Returns None if the user can see all departments (RECTOR), otherwise a list of ids they may see.
    A TEACHER may read (not write) their own department's reference data — they need
    subject/group names to make sense of their own assignments, timetable, and students.
    """
    if current_user.role == UserRole.RECTOR:
        return None
    if current_user.role == UserRole.DEAN and current_user.headed_department is not None:
        return [current_user.headed_department.id]
    if current_user.role == UserRole.TEACHER and current_user.teacher_profile is not None:
        return [current_user.teacher_profile.department_id]
    return []
