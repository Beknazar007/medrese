"""Fills the e2e/video stand database with made-up people — never real students or teachers.

Lessons are put on today's weekday (Bishkek) in an all-day slot, so a teacher can open
the journal whenever the tests or the video recording run.
Usage: DATABASE_URL=sqlite:///... python e2e/fixtures/seed.py
"""
import os
import sys
from datetime import datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

BACKEND = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.models import *  # noqa: E402,F401,F403
from app.models.enums import DayOfWeek, GroupType, UserRole  # noqa: E402
from app.models.timeslot import TimeSlot  # noqa: E402
from app.models.user import User  # noqa: E402
from tests import factories as f  # noqa: E402

# Logins used by e2e/fixtures/users.ts and videos/scenarios/*. Same password for all.
PASSWORD = "password"

url = os.environ["DATABASE_URL"]
if not url.startswith("sqlite"):
    sys.exit(f"seed.py only fills a local SQLite stand, refusing DATABASE_URL=...@{url.split('@')[-1]}")

engine = create_engine(url)
Base.metadata.drop_all(engine)
Base.metadata.create_all(engine)
today = datetime.now(ZoneInfo("Asia/Bishkek"))

with Session(engine) as db:
    db.add(User(username="rector", hashed_password=hash_password(PASSWORD), role=UserRole.RECTOR, must_change_password=False))
    dean = User(username="dean", hashed_password=hash_password(PASSWORD), role=UserRole.DEAN, must_change_password=False)
    db.add(dean)
    db.flush()
    ilim = f.make_department(db, "Илим бөлүмү")
    hafiz_dep = f.make_department(db, "Хафиздик бөлүмү")
    hafiz_dep.head_user_id = dean.id
    sem = f.make_semester(db, "2026 Күз")
    room1 = f.make_room(db, "101")
    room2 = f.make_room(db, "102")
    slot = TimeSlot(order=1, start_time=time(0, 0), end_time=time(23, 59))
    db.add(slot)
    db.flush()

    group = f.make_group(db, ilim, "Кары 1")
    hafiz_group = f.make_group(db, hafiz_dep, "Хафиз 1", GroupType.HAFIZ)
    for name in ("Асанов Эмир", "Бакиров Нурислам", "Жумабеков Адил", "Касымов Байэл"):
        f.make_student(db, group, name)
    for name in ("Осмонов Абдулла", "Токтогулов Умар", "Сыдыков Билал"):
        f.make_student(db, hafiz_group, name)

    teacher = f.make_teacher(db, ilim, "teacher")
    teacher.full_name = "Мамытов Азамат"
    hafiz_teacher = f.make_teacher(db, hafiz_dep, "hafiz")
    hafiz_teacher.full_name = "Абдыкадыров Ислам"
    for profile in (teacher, hafiz_teacher):
        profile.user.must_change_password = False

    subject = f.make_subject(db, ilim, "FIQ1")
    subject.name = "Фикх"
    hafiz_subject = f.make_subject(db, hafiz_dep, "HIF1")
    hafiz_subject.name = "Хифз"
    dow = DayOfWeek(today.isoweekday())
    f.make_schedule_entry(db, f.make_assignment(db, teacher, subject, group, sem), room1, slot, dow)
    f.make_schedule_entry(db, f.make_assignment(db, hafiz_teacher, hafiz_subject, hafiz_group, sem), room2, slot, dow)
    db.commit()

print(f"stand seeded for {today.date()} ({dow.name})")
