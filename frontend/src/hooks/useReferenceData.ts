import { useQuery } from "@tanstack/react-query";
import {
  departmentsApi,
  facultiesApi,
  groupsApi,
  roomsApi,
  semestersApi,
  subjectsApi,
  teachersApi,
  timeSlotsApi,
} from "../api/entities";

export function useFaculties() {
  return useQuery({ queryKey: ["faculties"], queryFn: () => facultiesApi.list() });
}

export function useDepartments() {
  return useQuery({ queryKey: ["departments"], queryFn: () => departmentsApi.list() });
}

export function useTeachers() {
  return useQuery({ queryKey: ["teachers"], queryFn: () => teachersApi.list() });
}

export function useSubjects() {
  return useQuery({ queryKey: ["subjects"], queryFn: () => subjectsApi.list() });
}

export function useGroups() {
  return useQuery({ queryKey: ["groups"], queryFn: () => groupsApi.list() });
}

export function useSemesters() {
  return useQuery({ queryKey: ["semesters"], queryFn: () => semestersApi.list() });
}

export function useRooms() {
  return useQuery({ queryKey: ["rooms"], queryFn: () => roomsApi.list() });
}

export function useTimeSlots() {
  return useQuery({ queryKey: ["timeslots"], queryFn: () => timeSlotsApi.list() });
}

/** The semester in use across the app: whichever is marked active, else the most recent. */
export function useActiveSemester() {
  const { data: semesters, ...rest } = useSemesters();
  const active = semesters?.find((s) => s.is_active) ?? semesters?.[semesters.length - 1];
  return { activeSemester: active, semesters, ...rest };
}

export function nameById<T extends { id: number }>(
  items: T[] | undefined,
  id: number,
  labelFn: (item: T) => string,
): string {
  const item = items?.find((i) => i.id === id);
  return item ? labelFn(item) : `#${id}`;
}
