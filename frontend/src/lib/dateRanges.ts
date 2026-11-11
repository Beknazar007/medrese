export type RangePreset = "day" | "week" | "month" | "year";

export interface DateRange {
  from: string;
  to: string;
}

import { isoOf as toIso } from "./localDate";

export function computeRange(preset: RangePreset): DateRange {
  const today = new Date();
  if (preset === "day") return { from: toIso(today), to: toIso(today) };

  if (preset === "week") {
    const day = today.getDay(); // 0 = Sunday
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
    return { from: toIso(monday), to: toIso(today) };
  }

  if (preset === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toIso(first), to: toIso(today) };
  }

  const jan1 = new Date(today.getFullYear(), 0, 1);
  return { from: toIso(jan1), to: toIso(today) };
}
