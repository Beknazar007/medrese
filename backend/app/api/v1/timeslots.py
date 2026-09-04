from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.timeslot import TimeSlot
from app.schemas.timeslot import TimeSlotCreate, TimeSlotOut, TimeSlotUpdate

router = APIRouter(prefix="/timeslots", tags=["timeslots"])


@router.get("", response_model=list[TimeSlotOut])
def list_timeslots(db: Session = Depends(get_db), _=Depends(get_current_user)) -> list[TimeSlot]:
    return list(db.scalars(select(TimeSlot).order_by(TimeSlot.order)).all())


@router.post("", response_model=TimeSlotOut, status_code=201)
def create_timeslot(
    payload: TimeSlotCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> TimeSlot:
    timeslot = TimeSlot(**payload.model_dump())
    db.add(timeslot)
    db.commit()
    db.refresh(timeslot)
    return timeslot


@router.patch("/{timeslot_id}", response_model=TimeSlotOut)
def update_timeslot(
    timeslot_id: int,
    payload: TimeSlotUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> TimeSlot:
    timeslot = db.get(TimeSlot, timeslot_id)
    if timeslot is None:
        raise HTTPException(status_code=404, detail="Time slot not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(timeslot, field, value)
    db.commit()
    db.refresh(timeslot)
    return timeslot


@router.delete("/{timeslot_id}", status_code=204)
def delete_timeslot(
    timeslot_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.RECTOR)),
) -> None:
    timeslot = db.get(TimeSlot, timeslot_id)
    if timeslot is None:
        raise HTTPException(status_code=404, detail="Time slot not found")
    db.delete(timeslot)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Cannot delete a time slot that still has schedule entries"
        ) from exc
