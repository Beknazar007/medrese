import { api } from "./client";
import type {
  Department,
  Faculty,
  Group,
  Room,
  ScheduleEntry,
  Semester,
  Subject,
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
  groupCoverage: async (semester_id: number): Promise<GroupCoverage[]> =>
    (await api.get<GroupCoverage[]>("/dashboard/group-coverage", { params: { semester_id } })).data,
};

export interface GroupCoverage {
  group_id: number;
  group_name: string;
  department_id: number;
  assignment_count: number;
  scheduled_assignment_count: number;
  coverage_percent: number;
}
