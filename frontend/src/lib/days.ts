import type { TFunction } from "i18next";
import type { DayOfWeek } from "../api/types";

export const WEEK_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6];

export function gridDays(t: TFunction) {
  return WEEK_DAYS.map((value) => ({ value, label: t(`days.${value}`) }));
}

export function todayAsDayOfWeek(): DayOfWeek {
  const jsDay = new Date().getDay(); // 0 = Sunday
  return (jsDay === 0 ? 7 : jsDay) as DayOfWeek;
}
