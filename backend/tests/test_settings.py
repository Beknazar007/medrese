import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.app_settings import AppSettings


def test_settings_table_holds_a_single_row_in_range(db: Session):
    db.add(AppSettings(id=1, late_threshold_minutes=15))
    db.flush()
    db.add(AppSettings(id=2, late_threshold_minutes=15))
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()

    db.add(AppSettings(id=1, late_threshold_minutes=61))
    with pytest.raises(IntegrityError):
        db.flush()
