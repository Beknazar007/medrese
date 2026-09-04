# Medrese — University Management System

Teacher, subject, group, and timetable management for a university's
rector/administration. Students and the online gradebook/journal are a
future phase — the data model already anticipates them.

## Stack

- **Backend:** FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, JWT auth
- **Frontend:** React + TypeScript (Vite), React Router, TanStack Query, i18next (ky/ru/en)

## Roles

- **Rector** — full access across all faculties/departments
- **Dean** — scoped to the department they head
- **Teacher** — read-only on their own profile, subjects, and timetable

## Setup

### 1. Database

```bash
docker-compose up -d db
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp ../.env.example ../.env   # edit if you want different credentials
alembic upgrade head
python -m app.seed           # creates the first Rector account
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs
Default seeded login: `rector` / `change-me` (change `SEED_RECTOR_PASSWORD` in `.env` before seeding for anything beyond local dev).

Run tests: `pytest` (from `backend/`, no live DB needed — uses in-memory SQLite).

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # points at the backend; edit if it's not on :8000
npm run dev
```

Opens on http://localhost:5173 (or the next free port — check the terminal output).

## What's built (v1)

- Faculties, Departments (with a Dean as head), Teachers, Subjects, Groups, Semesters, Rooms, Time Slots
- Teaching Assignments (teacher × subject × group × semester)
- Timetable with **conflict detection**: a teacher, room, or group can never be double-booked at the same day/time-slot within a semester — enforced both in a service layer (`app/services/schedule_conflict.py`, clear error messages) and as DB unique constraints (last-resort race-condition backstop)
- Rector dashboard: teacher workload and unassigned-subject coverage gaps
- Role-scoped access throughout (Rector sees everything; Dean is limited to their department; Teacher sees only their own data)

## What's next

- Students, Enrollment, online gradebook/journal, attendance
- Fuller frontend (Groups/Subjects/Schedule-builder UI, Dean/Rector admin screens) — the current frontend is a thin end-to-end shell (login, teacher list, personal schedule) proving the stack works
