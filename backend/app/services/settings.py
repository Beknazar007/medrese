from sqlalchemy.orm import Session

from app.models.app_settings import AppSettings

# Used when the settings row doesn't exist yet (fresh test or e2e databases; the migration
# inserts it in real ones). The only place the default lives.
DEFAULT_LATE_THRESHOLD = 15
_SETTINGS_ID = 1


def get_late_threshold(db: Session) -> int:
    settings = db.get(AppSettings, _SETTINGS_ID)
    return settings.late_threshold_minutes if settings is not None else DEFAULT_LATE_THRESHOLD


def set_late_threshold(db: Session, minutes: int) -> int:
    settings = db.get(AppSettings, _SETTINGS_ID)
    if settings is None:
        settings = AppSettings(id=_SETTINGS_ID, late_threshold_minutes=minutes)
        db.add(settings)
    else:
        settings.late_threshold_minutes = minutes
    db.flush()
    return settings.late_threshold_minutes
