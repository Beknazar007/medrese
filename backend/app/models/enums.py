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
