import type { HifzKind, HifzTarget } from "../../api/types";

// Dates are plain "YYYY-MM-DD" strings in local time — they compare correctly as strings.
const pad = (n: number) => String(n).padStart(2, "0");
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoOf(new Date());
export const parseIso = (s: string) => new Date(`${s}T00:00:00`); // local, not UTC

export function addDays(s: string, n: number): string {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000);
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length <= 400; d = addDays(d, 1)) out.push(d);
  return out;
}

export function weekRange(base = todayIso()): { from: string; to: string } {
  const from = addDays(base, -((parseIso(base).getDay() + 6) % 7)); // week starts Monday
  return { from, to: addDays(from, 6) };
}

export function monthRange(base = todayIso()): { from: string; to: string } {
  const d = parseIso(base);
  return {
    from: isoOf(new Date(d.getFullYear(), d.getMonth(), 1)),
    to: isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

/** 1 = Monday … 7 = Sunday, matching the `days.N` translation keys. */
export const dayOfWeek = (iso: string) => ((parseIso(iso).getDay() + 6) % 7) + 1;
export const fmtDate = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join(".") : "—");
export const fmtShort = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

export type Level = "ok" | "mid" | "low";
export const level = (p: number): Level => (p >= 85 ? "ok" : p >= 60 ? "mid" : "low");
export const LEVEL_COLOR: Record<Level, string> = { ok: "success.main", mid: "warning.dark", low: "error.main" };
export const LEVEL_CHIP: Record<Level, "success" | "warning" | "error"> = { ok: "success", mid: "warning", low: "error" };

export const KIND_KEYS = ["HIFZ", "REPEAT"] as const;

/** "5 juz" / "1–4 juz, 3–8 p." — the unit words come from translations. */
export function rangeText(
  a: { juz_from: number | null; juz_to: number | null; page_from?: number | null; page_to?: number | null },
  units: { juz: string; page: string },
): string {
  const parts: string[] = [];
  if (a.juz_from != null) {
    parts.push(a.juz_to != null && a.juz_to !== a.juz_from ? `${a.juz_from}–${a.juz_to} ${units.juz}` : `${a.juz_from} ${units.juz}`);
  }
  if (a.page_from != null) {
    parts.push(
      a.page_to != null && a.page_to !== a.page_from ? `${a.page_from}–${a.page_to} ${units.page}` : `${a.page_from} ${units.page}`,
    );
  }
  return parts.join(", ");
}

export type TargetStatus = "upcoming" | "active" | "done";
export function targetStatus(a: HifzTarget, ref = todayIso()): TargetStatus {
  if (ref < a.start_date) return "upcoming";
  if (ref > a.end_date) return "done";
  return "active";
}

/** The target in force on `date`; otherwise the latest one for that student + kind. */
export function activeTarget(targets: HifzTarget[], studentId: number, kind: HifzKind, date: string): HifzTarget | null {
  const list = targets.filter((a) => a.student_id === studentId && a.kind === kind);
  return list.find((a) => date >= a.start_date && date <= a.end_date) ?? list[0] ?? null;
}
