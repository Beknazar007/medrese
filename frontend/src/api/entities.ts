import { api } from "./client";
import type {
  AttendanceStatus,
  Department,
  Faculty,
  Group,
  HifzExam,
  HifzKind,
  HifzRosterStudent,
  HifzTarget,
  LessonSession,
  LessonSessionDetail,
  Room,
  ScheduleEntry,
  Semester,
  Student,
  StudentAttendanceSummary,
  StudentHistoryRow,
  StudentNote,
  StudentPerformanceRow,
  Subject,
  TeacherMonitoringRow,
  TeacherMonitoringSummary,
  TeacherSessionLogRow,
  TeacherWorkload,
  TeachingAssignment,
  TimeSlot,
} from "./types";

function crud<T, TCreate = Partial<T>, TUpdate = Partial<T>>(path: string) {
  return {
    list: async (params?: Record<string, unknown>): Promise<T[]> => (await api.get<T[]>(path, { params })).data,
    create: async (payload: TCreate): Promise<T> => (await api.post<T>(path, payload)).data,
    update: async (id: number, payload: TUpdate): Promise<T> => (await api.patch<T>(`${path}/${id}`, payload)).data,
    remove: async (id: number): Promise<void> => {
      await api.delete(`${path}/${id}`);
    },
  };
}

export const facultiesApi = crud<Faculty>("/faculties");
export const departmentsApi = crud<Department>("/departments");
export const subjectsApi = crud<Subject>("/subjects");
export const groupsApi = crud<Group>("/groups");
export const semestersApi = crud<Semester>("/semesters");
export const roomsApi = crud<Room>("/rooms");
export const timeSlotsApi = crud<TimeSlot>("/timeslots");

export const assignmentsApi = {
  list: async (params?: Record<string, unknown>): Promise<TeachingAssignment[]> =>
    (await api.get<TeachingAssignment[]>("/assignments", { params })).data,
  create: async (payload: Omit<TeachingAssignment, "id">): Promise<TeachingAssignment> =>
    (await api.post<TeachingAssignment>("/assignments", payload)).data,
  remove: async (id: number): Promise<void> => {
    await api.delete(`/assignments/${id}`);
  },
};

export const scheduleApi = {
  list: async (params?: Record<string, unknown>): Promise<ScheduleEntry[]> =>
    (await api.get<ScheduleEntry[]>("/schedule", { params })).data,
  create: async (payload: {
    assignment_id: number;
    room_id: number;
    time_slot_id: number;
    day_of_week: number;
  }): Promise<ScheduleEntry> => (await api.post<ScheduleEntry>("/schedule", payload)).data,
  remove: async (id: number): Promise<void> => {
    await api.delete(`/schedule/${id}`);
  },
};

export const usersApi = {
  list: async (role?: string) => (await api.get("/users", { params: role ? { role } : undefined })).data,
  create: async (payload: { username: string; password: string; email?: string; role: string }) =>
    (await api.post("/users", payload)).data,
};

export const teachersApi = {
  list: async (): Promise<import("./types").Teacher[]> =>
    (await api.get<import("./types").Teacher[]>("/teachers")).data,
  me: async (): Promise<import("./types").Teacher> =>
    (await api.get<import("./types").Teacher>("/teachers/me")).data,
  create: async (payload: Record<string, unknown>) => (await api.post("/teachers", payload)).data,
  update: async (id: number, payload: Record<string, unknown>) => (await api.patch(`/teachers/${id}`, payload)).data,
  remove: async (id: number): Promise<void> => {
    await api.delete(`/teachers/${id}`);
  },
};

export const dashboardApi = {
  workload: async (semester_id: number): Promise<TeacherWorkload[]> =>
    (await api.get<TeacherWorkload[]>("/dashboard/workload", { params: { semester_id } })).data,
  unassignedSubjects: async (semester_id: number): Promise<Subject[]> =>
    (await api.get<Subject[]>("/dashboard/unassigned-subjects", { params: { semester_id } })).data,
  teacherMonitoringSummary: async (params: {
    semester_id: number;
    date_from: string;
    date_to: string;
  }): Promise<TeacherMonitoringSummary> =>
    (await api.get<TeacherMonitoringSummary>("/dashboard/teacher-monitoring-summary", { params })).data,
  studentAttendanceSummary: async (params: {
    semester_id: number;
    date_from: string;
    date_to: string;
  }): Promise<StudentAttendanceSummary> =>
    (await api.get<StudentAttendanceSummary>("/dashboard/student-attendance-summary", { params })).data,
};

export const studentsApi = {
  ...crud<Student>("/students"),
  get: async (id: number): Promise<Student> => (await api.get<Student>(`/students/${id}`)).data,
  history: async (id: number): Promise<StudentHistoryRow[]> =>
    (await api.get<StudentHistoryRow[]>(`/students/${id}/history`)).data,
};

export const journalApi = {
  getOrCreateSession: async (schedule_entry_id: number, date: string): Promise<LessonSessionDetail> =>
    (await api.post<LessonSessionDetail>("/journal/sessions", { schedule_entry_id, date })).data,
  getSession: async (sessionId: number): Promise<LessonSessionDetail> =>
    (await api.get<LessonSessionDetail>(`/journal/sessions/${sessionId}`)).data,
  listSessions: async (schedule_entry_id: number) =>
    (await api.get<import("./types").LessonSession[]>("/journal/sessions", { params: { schedule_entry_id } })).data,
  putAttendance: async (
    sessionId: number,
    records: { student_id: number; status: AttendanceStatus }[],
  ): Promise<LessonSessionDetail> =>
    (await api.put<LessonSessionDetail>(`/journal/sessions/${sessionId}/attendance`, { records })).data,
  putGrades: async (sessionId: number, records: { student_id: number; score: number }[]): Promise<LessonSessionDetail> =>
    (await api.put<LessonSessionDetail>(`/journal/sessions/${sessionId}/grades`, { records })).data,
  checkOut: async (sessionId: number): Promise<LessonSession> =>
    (await api.put<LessonSession>(`/journal/sessions/${sessionId}/check-out`)).data,
  performance: async (assignment_id: number): Promise<StudentPerformanceRow[]> =>
    (await api.get<StudentPerformanceRow[]>("/journal/performance", { params: { assignment_id } })).data,
};

export const monitoringApi = {
  teachers: async (params: { semester_id: number; date_from: string; date_to: string }): Promise<TeacherMonitoringRow[]> =>
    (await api.get<TeacherMonitoringRow[]>("/monitoring/teachers", { params })).data,
  teacherSessions: async (
    teacherId: number,
    params: { semester_id: number; date_from: string; date_to: string },
  ): Promise<TeacherSessionLogRow[]> =>
    (await api.get<TeacherSessionLogRow[]>(`/monitoring/teachers/${teacherId}/sessions`, { params })).data,
};

export const hifzApi = {
  groups: async (): Promise<Group[]> => (await api.get<Group[]>("/hifz/groups")).data,
  roster: async (group_id: number, date: string): Promise<HifzRosterStudent[]> =>
    (await api.get<HifzRosterStudent[]>("/hifz/roster", { params: { group_id, date } })).data,
  putRecords: async (
    group_id: number,
    date: string,
    records: {
      student_id: number;
      kind: HifzKind;
      score: number | null;
      juz: number | null;
      page_from: number | null;
      page_to: number | null;
      comment: string | null;
    }[],
  ): Promise<HifzRosterStudent[]> =>
    (await api.put<HifzRosterStudent[]>("/hifz/records", { group_id, date, records })).data,
  targets: async (studentId: number): Promise<HifzTarget[]> =>
    (await api.get<HifzTarget[]>("/hifz/targets", { params: { student_id: studentId } })).data,
  createTarget: async (payload: Omit<HifzTarget, "id">): Promise<HifzTarget> =>
    (await api.post<HifzTarget>("/hifz/targets", payload)).data,
  updateTarget: async (id: number, payload: Partial<Omit<HifzTarget, "id" | "student_id">>): Promise<HifzTarget> =>
    (await api.patch<HifzTarget>(`/hifz/targets/${id}`, payload)).data,
  removeTarget: async (id: number): Promise<void> => {
    await api.delete(`/hifz/targets/${id}`);
  },
  exams: async (studentId: number): Promise<HifzExam[]> =>
    (await api.get<HifzExam[]>("/hifz/exams", { params: { student_id: studentId } })).data,
  createExam: async (payload: Omit<HifzExam, "id">): Promise<HifzExam> =>
    (await api.post<HifzExam>("/hifz/exams", payload)).data,
  updateExam: async (id: number, payload: Partial<Omit<HifzExam, "id" | "student_id">>): Promise<HifzExam> =>
    (await api.patch<HifzExam>(`/hifz/exams/${id}`, payload)).data,
  removeExam: async (id: number): Promise<void> => {
    await api.delete(`/hifz/exams/${id}`);
  },
};

export const notesApi = {
  list: async (studentId: number): Promise<StudentNote[]> =>
    (await api.get<StudentNote[]>(`/students/${studentId}/notes`)).data,
  create: async (
    studentId: number,
    payload: { body: string; visibility: "PRIVATE" | "SHARED" },
  ): Promise<StudentNote> => (await api.post<StudentNote>(`/students/${studentId}/notes`, payload)).data,
  remove: async (noteId: number): Promise<void> => {
    await api.delete(`/notes/${noteId}`);
  },
};
