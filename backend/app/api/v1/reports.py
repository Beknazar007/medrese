from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import assert_department_access, require_role
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.group import Group
from app.models.user import User
from app.services.reports import generate_weekly_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/weekly.xlsx")
def get_weekly_report(
    semester_id: int,
    date_from: date,
    date_to: date,
    group_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECTOR, UserRole.DEAN)),
) -> StreamingResponse:
    department_id = None
    if current_user.role == UserRole.DEAN and current_user.headed_department is not None:
        department_id = current_user.headed_department.id

    if group_id is not None:
        group = db.get(Group, group_id)
        if group is None:
            raise HTTPException(status_code=404, detail="Group not found")
        assert_department_access(current_user, group.department_id)

    content = generate_weekly_report(
        db,
        semester_id=semester_id,
        date_from=date_from,
        date_to=date_to,
        department_id=department_id,
        group_id=group_id,
    )
    filename = f"report_{date_from}_{date_to}.xlsx"
    return StreamingResponse(
        iter([content]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
