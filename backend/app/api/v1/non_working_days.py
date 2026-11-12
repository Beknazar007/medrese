from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.non_working_day import NonWorkingDay
from app.models.user import User
from app.schemas.non_working_day import NonWorkingDayCreate, NonWorkingDayOut, NonWorkingDayUpdate

router = APIRouter(prefix="/non-working-days", tags=["non-working-days"])


@router.get("", response_model=list[NonWorkingDayOut])
def list_non_working_days(
    db: Session = Depends(get_db),
    # A dean reads them to understand monitoring, but holidays are set for the whole madrasa
    # by the rector only.
    _=Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> list[NonWorkingDay]:
    return list(
        db.scalars(select(NonWorkingDay).order_by(NonWorkingDay.start_date.desc(), NonWorkingDay.id.desc())).all()
    )


@router.post("", response_model=NonWorkingDayOut, status_code=201)
def create_non_working_day(
    payload: NonWorkingDayCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR)),
) -> NonWorkingDay:
    day = NonWorkingDay(**payload.model_dump(), created_by_user_id=current_user.id)
    db.add(day)
    db.commit()
    db.refresh(day)
    return day


@router.patch("/{day_id}", response_model=NonWorkingDayOut)
def update_non_working_day(
    day_id: int,
    payload: NonWorkingDayUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> NonWorkingDay:
    day = db.get(NonWorkingDay, day_id)
    if day is None:
        raise HTTPException(status_code=404, detail="Non-working day not found")
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is None:
        raise HTTPException(status_code=422, detail="Name must not be empty")
    start = changes.get("start_date") or day.start_date
    end = changes.get("end_date") or day.end_date
    if end < start:
        raise HTTPException(status_code=422, detail="end_date must not be before start_date")
    for field, value in changes.items():
        if value is not None:
            setattr(day, field, value)
    db.commit()
    db.refresh(day)
    return day


@router.delete("/{day_id}", status_code=204)
def delete_non_working_day(
    day_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> None:
    day = db.get(NonWorkingDay, day_id)
    if day is None:
        raise HTTPException(status_code=404, detail="Non-working day not found")
    db.delete(day)
    db.commit()
