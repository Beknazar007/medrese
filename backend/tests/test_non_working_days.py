from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.non_working_day import NonWorkingDay


def test_non_working_day_end_cannot_precede_start(db: Session):
    db.add(NonWorkingDay(name="Nooruz", start_date=date(2027, 3, 21), end_date=date(2027, 3, 20)))
    with pytest.raises(IntegrityError):
        db.flush()
