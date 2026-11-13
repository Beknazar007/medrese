from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db.session import get_db
from app.models.enums import UserRole
from app.schemas.settings import AppSettingsOut, AppSettingsUpdate
from app.services import settings as settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=AppSettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> AppSettingsOut:
    return AppSettingsOut(late_threshold_minutes=settings_service.get_late_threshold(db))


@router.patch("", response_model=AppSettingsOut)
def update_settings(
    payload: AppSettingsUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> AppSettingsOut:
    minutes = settings_service.set_late_threshold(db, payload.late_threshold_minutes)
    db.commit()
    return AppSettingsOut(late_threshold_minutes=minutes)
