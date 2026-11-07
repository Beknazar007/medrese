import type { AttendanceStatus } from "../api/types";

// Shared by the regular journal and the hifz journal so attendance is taken identically in both.
export const ATTENDANCE_OPTIONS: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export const ATTENDANCE_ROW_TINT: Partial<Record<AttendanceStatus, string>> = {
  ABSENT: "rgba(198,40,40,.06)",
  LATE: "rgba(224,134,0,.08)",
};

export function countAttendance(statuses: (AttendanceStatus | null)[]): Record<AttendanceStatus | "UNSET", number> {
  const counts: Record<AttendanceStatus | "UNSET", number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, UNSET: 0 };
  for (const status of statuses) {
    if (status) counts[status] += 1;
    else counts.UNSET += 1;
  }
  return counts;
}
