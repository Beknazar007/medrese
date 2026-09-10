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
  photo: string | null;
  education: string | null;
  competency: string | null;
  teaching_experience_years: number | null;
  previous_subjects: string | null;
  can_teach: string | null;
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

export type GroupType = "REGULAR" | "HAFIZ";

export interface Group {
  id: number;
  name: string;
  specialty: string;
  course_year: number;
  department_id: number;
  group_type: GroupType;
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
  photo: string | null;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type NoteVisibility = "PRIVATE" | "SHARED";

export interface LessonSession {
  id: number;
  schedule_entry_id: number;
  date: string;
  teacher_checked_in_at: string | null;
  teacher_checked_out_at: string | null;
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

export interface TeacherMonitoringRow {
  teacher_id: number;
  full_name: string;
  department_id: number;
  expected_lessons: number;
  conducted_lessons: number;
  missed_lessons: number;
}

export interface TeacherMonitoringSummary {
  expected_lessons: number;
  conducted_lessons: number;
  missed_lessons: number;
  top_missed: TeacherMonitoringRow[];
}

export interface StudentAttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  average_score: number | null;
}

export interface TeacherSessionLogRow {
  date: string;
  subject_name: string;
  group_name: string;
  conducted: boolean;
  checked_in_at: string | null;
  checked_out_at: string | null;
}

export interface StudentNote {
  id: number;
  student_id: number;
  author_teacher_id: number;
  body: string;
  visibility: NoteVisibility;
  created_at: string;
}

export type HifzKind = "HIFZ" | "REPEAT";

export interface HifzTarget {
  id: number;
  student_id: number;
  kind: HifzKind;
  juz_from: number | null;
  juz_to: number | null;
  page_from: number | null;
  page_to: number | null;
  start_date: string;
  end_date: string;
  note: string | null;
}

export interface HifzExam {
  id: number;
  student_id: number;
  date: string;
  title: string;
  juz_from: number | null;
  juz_to: number | null;
  score: number | null;
  comment: string | null;
}

export interface HifzRecordDetail {
  score: number | null;
  juz: number | null;
  page_from: number | null;
  page_to: number | null;
  comment: string | null;
}

export interface HifzRosterStudent {
  student_id: number;
  full_name: string;
  student_number: string | null;
  hifz: HifzRecordDetail;
  repeat: HifzRecordDetail;
}
