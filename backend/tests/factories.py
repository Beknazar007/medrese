from datetime import date, time

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.assignment import TeachingAssignment
from app.models.department import Department
from app.models.enums import DayOfWeek, GroupType, HourType, UserRole
from app.models.group import Group
from app.models.room import Room
from app.models.schedule import ScheduleEntry
from app.models.semester import Semester
from app.models.student import Student
from app.models.subject import Subject
from app.models.teacher import TeacherProfile
from app.models.timeslot import TimeSlot
from app.models.user import User


def make_department(db: Session, name: str = "Theology") -> Department:
    department = Department(name=name)
    db.add(department)
    db.flush()
    return department


def make_teacher(db: Session, department: Department, username: str = "teacher1") -> TeacherProfile:
    user = User(username=username, hashed_password=hash_password("password"), role=UserRole.TEACHER)
    db.add(user)
    db.flush()
    teacher = TeacherProfile(user_id=user.id, department_id=department.id, full_name=username)
    db.add(teacher)
    db.flush()
    return teacher


def make_subject(db: Session, department: Department, code: str = "MTH101") -> Subject:
    subject = Subject(name="Mathematics", code=code, department_id=department.id, lecture_hours=30)
    db.add(subject)
    db.flush()
    return subject


def make_group(
    db: Session, department: Department, name: str = "G-101", group_type: GroupType = GroupType.REGULAR
) -> Group:
    group = Group(name=name, specialty="Theology", course_year=1, department_id=department.id, group_type=group_type)
    db.add(group)
    db.flush()
    return group


def make_semester(db: Session, name: str = "2026 Fall") -> Semester:
    semester = Semester(name=name, start_date=date(2026, 9, 1), end_date=date(2026, 12, 31), is_active=True)
    db.add(semester)
    db.flush()
    return semester


def make_room(db: Session, name: str = "101") -> Room:
    room = Room(name=name, building="Main")
    db.add(room)
    db.flush()
    return room


def make_time_slot(db: Session, order: int = 1) -> TimeSlot:
    slot = TimeSlot(order=order, start_time=time(8, 0), end_time=time(8, 50))
    db.add(slot)
    db.flush()
    return slot


def make_assignment(
    db: Session,
    teacher: TeacherProfile,
    subject: Subject,
    group: Group,
    semester: Semester,
    hour_type: HourType = HourType.LECTURE,
) -> TeachingAssignment:
    assignment = TeachingAssignment(
        teacher_id=teacher.id,
        subject_id=subject.id,
        group_id=group.id,
        semester_id=semester.id,
        hour_type=hour_type,
    )
    db.add(assignment)
    db.flush()
    return assignment


def make_student(db: Session, group: Group, full_name: str = "Student One") -> Student:
    student = Student(full_name=full_name, group_id=group.id)
    db.add(student)
    db.flush()
    return student


def make_schedule_entry(
    db: Session,
    assignment: TeachingAssignment,
    room: Room,
    time_slot: TimeSlot,
    day_of_week: DayOfWeek = DayOfWeek.MONDAY,
) -> ScheduleEntry:
    entry = ScheduleEntry(
        assignment_id=assignment.id,
        semester_id=assignment.semester_id,
        teacher_id=assignment.teacher_id,
        group_id=assignment.group_id,
        room_id=room.id,
        time_slot_id=time_slot.id,
        day_of_week=day_of_week,
    )
    db.add(entry)
    db.flush()
    return entry
