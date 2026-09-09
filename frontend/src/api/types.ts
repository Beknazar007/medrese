export type UserRole = "RECTOR" | "DEAN" | "TEACHER";
export type HourType = "LECTURE" | "PRACTICE" | "LAB";
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface CurrentUser {
  id: number;
  username: string;
  email: string | null;
  role: UserRole;
  is_active: boolean;
  headed_department_id: number | null;
}

export interface Faculty {
  id: number;
  name: string;
}

export interface Department {
  id: number;
  name: string;
  faculty_id: number;
  head_user_id: number | null;
}

export interface Teacher {
  id: number;
  user_id: number;
  username: string;
  department_id: number;
  full_name: string;
  academic_degree: string | null;
  phone: string | null;
  hire_date: string | null;
  bio: string | null;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  department_id: number;
  lecture_hours: number;
  practice_hours: number;
  lab_hours: number;
}

export interface Group {
  id: number;
  name: string;
  specialty: string;
  course_year: number;
  department_id: number;
}

export interface Semester {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface Room {
  id: number;
  name: string;
  building: string;
  capacity: number | null;
}

export interface TimeSlot {
  id: number;
  order: number;
  start_time: string;
  end_time: string;
}

export interface TeachingAssignment {
  id: number;
  teacher_id: number;
  subject_id: number;
  group_id: number;
  semester_id: number;
  hour_type: HourType;
}

export interface ScheduleEntry {
  id: number;
  assignment_id: number;
  semester_id: number;
  teacher_id: number;
  group_id: number;
  room_id: number;
  time_slot_id: number;
  day_of_week: DayOfWeek;
}

export interface TeacherWorkload {
  teacher_id: number;
  full_name: string;
  department_id: number;
  assignment_count: number;
  weekly_scheduled_periods: number;
}

export interface Student {
  id: number;
  full_name: string;
  group_id: number;
  student_number: string | null;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  enrollment_date: string | null;
  is_active: boolean;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type NoteVisibility = "PRIVATE" | "SHARED";

export interface LessonSession {
  id: number;
  schedule_entry_id: number;
  date: string;
}

export interface RosterStudent {
  student_id: number;
  full_name: string;
  student_number: string | null;
  attendance_status: AttendanceStatus | null;
  score: number | null;
}

export interface LessonSessionDetail {
  session: LessonSession;
  roster: RosterStudent[];
}

export interface StudentPerformanceRow {
  student_id: number;
  full_name: string;
  average_score: number | null;
  sessions_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
}

export interface StudentHistoryRow {
  session_id: number;
  date: string;
  subject_id: number;
  subject_name: string;
  teacher_id: number;
  teacher_name: string;
  hour_type: HourType;
  semester_id: number;
  score: number | null;
  attendance_status: AttendanceStatus | null;
}

export interface StudentNote {
  id: number;
  student_id: number;
  author_teacher_id: number;
  body: string;
  visibility: NoteVisibility;
  created_at: string;
}
