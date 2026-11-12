import type { LessonMarkKind, Semester } from "../api/types";
import type { DateRange } from "./dateRanges";
import { STATUS_FILL } from "./palette";

/** Chip color for a "conducted %" value: ≥ 90 good, 70–89 warning, below 70 bad. */
export function percentColor(percent: number): string {
  if (percent >= 90) return STATUS_FILL.present;
  if (percent >= 70) return STATUS_FILL.late;
  return STATUS_FILL.absent;
}

/** The same thresholds as percentColor, as a text tone that stays readable in both themes. */
export function percentTone(percent: number | null): "neutral" | "good" | "warning" | "bad" {
  if (percent === null) return "neutral";
  if (percent >= 90) return "good";
  if (percent >= 70) return "warning";
  return "bad";
}

/** True when the picked period doesn't touch the semester at all — the server then returns an
 * empty list, and the page should say why instead of "no lessons". ISO dates compare as strings. */
export function periodOutsideSemester(range: DateRange, semester: Semester | undefined): boolean {
  if (!semester) return false;
  return range.to < semester.start_date || range.from > semester.end_date;
}

/** i18n keys of the three reasons a missed lesson can be marked with. */
export const MARK_REASON_KEYS: Record<LessonMarkKind, string> = {
  FORGOT_TO_OPEN: "monitoring.reason_forgot",
  EXCUSED: "monitoring.reason_excused",
  CANCELLED: "monitoring.reason_cancelled",
};
