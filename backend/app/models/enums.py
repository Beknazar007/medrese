import enum


class UserRole(str, enum.Enum):
    RECTOR = "RECTOR"
    DEAN = "DEAN"
    TEACHER = "TEACHER"


class HourType(str, enum.Enum):
    LECTURE = "LECTURE"
    PRACTICE = "PRACTICE"
    LAB = "LAB"


class DayOfWeek(int, enum.Enum):
    MONDAY = 1
    TUESDAY = 2
    WEDNESDAY = 3
    THURSDAY = 4
    FRIDAY = 5
    SATURDAY = 6
    SUNDAY = 7


class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LATE = "LATE"
    EXCUSED = "EXCUSED"


class NoteVisibility(str, enum.Enum):
    PRIVATE = "PRIVATE"
    SHARED = "SHARED"


class GroupType(str, enum.Enum):
    REGULAR = "REGULAR"
    HAFIZ = "HAFIZ"


class HifzKind(str, enum.Enum):
    HIFZ = "HIFZ"
    REPEAT = "REPEAT"


class LessonMarkKind(str, enum.Enum):
    """Why a missed lesson isn't really a miss, set by the rector or dean."""

    FORGOT_TO_OPEN = "FORGOT_TO_OPEN"  # held, the teacher just didn't open it in the app
    EXCUSED = "EXCUSED"
    CANCELLED = "CANCELLED"
