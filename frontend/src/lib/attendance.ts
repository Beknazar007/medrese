import type { AttendanceStatus } from "../api/types";

// Shared by the regular journal and the hifz journal so attendance is taken identically in both.
export const ATTENDANCE_OPTIONS: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export const ATTENDANCE_ROW_TINT: Partial<Record<AttendanceStatus, string>> = {
  // Per-theme values: see paletteCssVars.
  ABSENT: "var(--tint-absent)",
  LATE: "var(--tint-late)",
};

export function countAttendance(statuses: (AttendanceStatus | null)[]): Record<AttendanceStatus | "UNSET", number> {
  const counts: Record<AttendanceStatus | "UNSET", number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, UNSET: 0 };
  for (const status of statuses) {
    if (status) counts[status] += 1;
    else counts.UNSET += 1;
  }
  return counts;
}

// Keys are built in one place so the toggle, the legend and the counters can't drift apart.
export function attendanceLabelKey(status: AttendanceStatus): string {
  return `journal.attendance_${status.toLowerCase()}`;
}

export function attendanceLetterKey(status: AttendanceStatus): string {
  return `journal.attendance_short_${status.toLowerCase()}`;
}
