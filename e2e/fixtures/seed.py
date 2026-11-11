"""Fills the e2e/video stand database with made-up people — never real students or teachers.

Today's lessons sit in an all-day slot (pair 1), so a teacher can open the journal whenever the
tests or the video recording run. Six past weeks of lessons with marks, exam grades, hifz records,
a note and an excuse make the summary, monitoring and dashboard screens look like real use.
Usage: DATABASE_URL=sqlite:///... python e2e/fixtures/seed.py
"""
import os
import random
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

BACKEND = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.models import *  # noqa: E402,F401,F403
from app.models.attendance import AttendanceRecord  # noqa: E402
from app.models.enums import AttendanceStatus, DayOfWeek, GroupType, HifzKind, HourType, NoteVisibility, UserRole  # noqa: E402
from app.models.excuse import StudentExcuse  # noqa: E402
from app.models.grade import GradeRecord  # noqa: E402
from app.models.hifz import HifzExam, HifzRecord, HifzTarget  # noqa: E402
from app.models.lesson_session import LessonSession  # noqa: E402
from app.models.note import StudentNote  # noqa: E402
from app.models.semester import Semester  # noqa: E402
from app.models.timeslot import TimeSlot  # noqa: E402
from app.models.user import User  # noqa: E402
from tests import factories as f  # noqa: E402

# Logins used by e2e/fixtures/users.ts and videos/scenarios/*. Same password for all.
PASSWORD = "password"
WEEKS_OF_HISTORY = 6

url = os.environ["DATABASE_URL"]
if not url.startswith("sqlite"):
    sys.exit(f"seed.py only fills a local SQLite stand, refusing DATABASE_URL=...@{url.split('@')[-1]}")

rnd = random.Random(7)  # same data on every run, so videos are reproducible
engine = create_engine(url)
Base.metadata.drop_all(engine)
Base.metadata.create_all(engine)
tz = ZoneInfo("Asia/Bishkek")
now = datetime.now(tz)
today = now.date()
dow_today = DayOfWeek(today.isoweekday())


def other_days(n: int) -> list[DayOfWeek]:
    """n weekdays (Mon–Sat) other than today, so the week grid is not empty."""
    days = [DayOfWeek(d) for d in range(1, 7) if d != today.isoweekday()]
    return days[:n]


def past_dates(day: DayOfWeek) -> list[date]:
    """The last WEEKS_OF_HISTORY dates that fell on `day`, before today."""
    delta = (today.isoweekday() - day.value) % 7 or 7
    first = today - timedelta(days=delta)
    return [first - timedelta(weeks=w) for w in range(WEEKS_OF_HISTORY)]


def at(d: date, hh: int, mm: int) -> datetime:
    return datetime.combine(d, time(hh, mm), tz)


with Session(engine) as db:
    rector = User(username="rector", hashed_password=hash_password(PASSWORD), role=UserRole.RECTOR, must_change_password=False)
    dean = User(username="dean", hashed_password=hash_password(PASSWORD), role=UserRole.DEAN, must_change_password=False)
    db.add_all([rector, dean])
    db.flush()
    ilim = f.make_department(db, "Илим бөлүмү")
    hafiz_dep = f.make_department(db, "Хафиздик бөлүмү")
    hafiz_dep.head_user_id = dean.id
    sem = f.make_semester(db, "2026 Күз")
    room1, room2, room3 = f.make_room(db, "101"), f.make_room(db, "102"), f.make_room(db, "201")

    # Pair 1 lasts all day so "today" lessons open at any hour; the others look like a real timetable.
    slot1 = TimeSlot(order=1, start_time=time(0, 0), end_time=time(23, 59))
    slot2 = TimeSlot(order=2, start_time=time(9, 30), end_time=time(10, 50))
    slot3 = TimeSlot(order=3, start_time=time(11, 0), end_time=time(12, 20))
    db.add_all([slot1, slot2, slot3])
    db.flush()

    group = f.make_group(db, ilim, "Кары 1")
    group2 = f.make_group(db, ilim, "Кары 2")
    hafiz_group = f.make_group(db, hafiz_dep, "Хафиз 1", GroupType.HAFIZ)
    students = [
        f.make_student(db, group, name)
        for name in ("Асанов Эмир", "Бакиров Нурислам", "Жумабеков Адил", "Касымов Байэл",
                     "Мамбетов Алихан", "Нурланов Ислам", "Орозов Тимур", "Сатыбалдиев Аким")
    ]
    students2 = [f.make_student(db, group2, name) for name in ("Абдраимов Аман", "Бекболотов Нурбек", "Токтосунов Арсен")]
    hafiz_students = [f.make_student(db, hafiz_group, name) for name in ("Осмонов Абдулла", "Токтогулов Умар", "Сыдыков Билал")]

    teacher = f.make_teacher(db, ilim, "teacher")
    teacher.full_name = "Мамытов Азамат"
    teacher2 = f.make_teacher(db, ilim, "teacher2")
    teacher2.full_name = "Садыков Эрлан"
    hafiz_teacher = f.make_teacher(db, hafiz_dep, "hafiz")
    hafiz_teacher.full_name = "Абдыкадыров Ислам"
    for profile in (teacher, teacher2, hafiz_teacher):
        profile.user.must_change_password = False

    fiqh = f.make_subject(db, ilim, "FIQ1")
    fiqh.name = "Фикх"
    aqida = f.make_subject(db, ilim, "AQD1")
    aqida.name = "Акыйда"
    arabic = f.make_subject(db, ilim, "ARB1")
    arabic.name = "Араб тили"
    hifz_subject = f.make_subject(db, hafiz_dep, "HIF1")
    hifz_subject.name = "Хифз"

    a_fiqh = f.make_assignment(db, teacher, fiqh, group, sem)
    a_aqida = f.make_assignment(db, teacher, aqida, group, sem)
    a_arabic = f.make_assignment(db, teacher, arabic, group2, sem)
    a_t2 = f.make_assignment(db, teacher2, arabic, group, sem)
    a_hifz = f.make_assignment(db, hafiz_teacher, hifz_subject, hafiz_group, sem)

    d1, d2, d3 = other_days(3)
    e_fiqh = f.make_schedule_entry(db, a_fiqh, room1, slot1, dow_today)
    e_hifz = f.make_schedule_entry(db, a_hifz, room2, slot1, dow_today)
    e_aqida = f.make_schedule_entry(db, a_aqida, room1, slot2, d1)
    e_arabic = f.make_schedule_entry(db, a_arabic, room3, slot3, d2)
    e_t2 = f.make_schedule_entry(db, a_t2, room1, slot2, d3)

    # One student is excused for last week — shows up in the journal and on the excuses page.
    excused = students[3]
    week_ago = today - timedelta(days=7)
    db.add(StudentExcuse(student_id=excused.id, date_from=week_ago - timedelta(days=1), date_to=week_ago + timedelta(days=1),
                         reason="Ооруп калды (справка бар)", created_by_id=dean.id))

    # Past lessons: most teachers mark, teacher2 skips some (so monitoring has something to show).
    statuses = [AttendanceStatus.PRESENT] * 8 + [AttendanceStatus.LATE, AttendanceStatus.ABSENT]
    for entry, roster, skip_rate in ((e_fiqh, students, 0.0), (e_aqida, students, 0.0), (e_arabic, students2, 0.1),
                                     (e_t2, students, 0.5), (e_hifz, hafiz_students, 0.0)):
        for i, d in enumerate(past_dates(entry.day_of_week)):
            if rnd.random() < skip_rate:
                continue  # lesson never opened: counts as missed in monitoring
            start = slot1.start_time if entry.time_slot_id == slot1.id else (slot2 if entry.time_slot_id == slot2.id else slot3).start_time
            hh, mm = (9, 0) if start == time(0, 0) else (start.hour, start.minute)
            late = rnd.random() < 0.15
            session = LessonSession(schedule_entry_id=entry.id, date=d, teacher_id=entry.teacher_id, is_exam=(i == 2 and entry is not e_hifz),
                                    teacher_checked_in_at=at(d, hh, mm + (12 if late else 1)),
                                    teacher_checked_out_at=at(d, hh + 1, mm + 15))
            db.add(session)
            db.flush()
            for s in roster:
                status = AttendanceStatus.EXCUSED if (s is excused and abs((d - week_ago).days) <= 1) else rnd.choice(statuses)
                db.add(AttendanceRecord(session_id=session.id, student_id=s.id, status=status))
                if session.is_exam and status in (AttendanceStatus.PRESENT, AttendanceStatus.LATE):
                    db.add(GradeRecord(session_id=session.id, student_id=s.id, score=rnd.randint(62, 98)))

    db.add(StudentNote(student_id=students[1].id, author_teacher_id=teacher.id, visibility=NoteVisibility.SHARED,
                       body="Сабакта активдүү, үй тапшырмасын дайыма аткарат."))

    # Hifz: a running assignment for the group, daily scores for the last two weeks, one exam each.
    for s in hafiz_students:
        db.add(HifzTarget(student_id=s.id, kind=HifzKind.HIFZ, juz_from=1, juz_to=1, page_from=1, page_to=20,
                          start_date=today - timedelta(days=14), end_date=today + timedelta(days=6), note="күнүнө 1 бет"))
        for back in range(1, 15):
            d = today - timedelta(days=back)
            if d.isoweekday() == 7:
                continue
            db.add(HifzRecord(student_id=s.id, date=d, kind=HifzKind.HIFZ, score=rnd.randint(70, 100),
                              juz="1", page_from=back, page_to=back))
            db.add(HifzRecord(student_id=s.id, date=d, kind=HifzKind.REPEAT, score=rnd.randint(65, 100), juz="1"))
        db.add(HifzExam(student_id=s.id, date=today - timedelta(days=10), title="1-жуз", juz_from=1, juz_to=1,
                        score=rnd.randint(75, 98)))

    # Extra data for e2e/tests/ux-fixes only (Playwright sets E2E_EXTRA_DATA=1). Video recording
    # runs without it, so the screens in the videos stay exactly as they were. No rnd here.
    if os.environ.get("E2E_EXTRA_DATA") == "1":
        db.add(Semester(name="2026 Жаз", start_date=date(2026, 2, 1), end_date=date(2026, 6, 30), is_active=False))
        group3 = f.make_group(db, ilim, "Кары 3")
        prep_group = f.make_group(db, hafiz_dep, "Даярдоо 1")  # another department's ordinary group
        for name in ("Иманалиев Саид", "Жолдошев Бекзат"):
            f.make_student(db, group3, name)
        f.make_student(db, prep_group, "Курманов Алым")

        extra_teachers = {}
        for username, full_name in (("teacher3", "Жээнбеков Канат"), ("teacher4", "Токтоматов Нурлан"),
                                    ("teacher5", "Эсенов Бакыт")):
            profile = f.make_teacher(db, ilim, username)
            profile.full_name = full_name
            profile.user.must_change_password = False
            extra_teachers[username] = profile
        t3, t4, t5 = extra_teachers["teacher3"], extra_teachers["teacher4"], extra_teachers["teacher5"]

        history = f.make_subject(db, ilim, "TAR1")
        history.name = "Тарых"
        sira = f.make_subject(db, ilim, "SIR1")
        sira.name = "Сира"
        tajwid = f.make_subject(db, hafiz_dep, "TJW1")
        tajwid.name = "Тажвид"

        # Replacement target (B5.R1–R4): teacher3 → teacher5; teacher4 is busy at the same pair (B5.R2).
        a_rep = f.make_assignment(db, t3, history, group3, sem)
        a_busy = f.make_assignment(db, t4, sira, group2, sem)
        # Subject and group of another department on an ilim teacher (criterion 4).
        a_cross = f.make_assignment(db, t3, tajwid, prep_group, sem)
        # Scheduled assignment whose subject is renamed and whose group change is refused (criterion 28).
        a_rename = f.make_assignment(db, t4, history, group3, sem, HourType.PRACTICE)
        # Not in the timetable: edited freely (criterion 27) and turned into a duplicate (criterion 29).
        f.make_assignment(db, t5, sira, group3, sem)
        f.make_assignment(db, t5, history, group2, sem)
        f.make_schedule_entry(db, a_rep, room2, slot3, d1)
        f.make_schedule_entry(db, a_busy, room3, slot3, d1)
        f.make_schedule_entry(db, a_cross, room2, slot2, d2)
        f.make_schedule_entry(db, a_rename, room2, slot3, d3)

        # Password-change accounts (B6): each test changes the password and sets it back, but the
        # "recommend changing" banner disappears for good — so one account per device project.
        for username in ("pwd_teacher_mobile", "pwd_teacher_desktop"):
            f.make_teacher(db, ilim, username).user.must_change_password = True
        db.add(User(username="pwd_rector", hashed_password=hash_password(PASSWORD), role=UserRole.RECTOR,
                    must_change_password=True))
    db.commit()

print(f"stand seeded for {today} ({dow_today.name})")
