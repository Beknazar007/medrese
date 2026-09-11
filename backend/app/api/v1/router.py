from fastapi import APIRouter

from app.api.v1 import (
    assignments,
    auth,
    dashboard,
    departments,
    groups,
    hifz,
    journal,
    monitoring,
    notes,
    reports,
    rooms,
    schedule,
    semesters,
    students,
    subjects,
    teachers,
    timeslots,
    users,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(departments.router)
api_router.include_router(teachers.router)
api_router.include_router(subjects.router)
api_router.include_router(groups.router)
api_router.include_router(semesters.router)
api_router.include_router(rooms.router)
api_router.include_router(timeslots.router)
api_router.include_router(assignments.router)
api_router.include_router(schedule.router)
api_router.include_router(dashboard.router)
api_router.include_router(students.router)
api_router.include_router(journal.router)
api_router.include_router(notes.router)
api_router.include_router(monitoring.router)
api_router.include_router(hifz.router)
api_router.include_router(reports.router)
