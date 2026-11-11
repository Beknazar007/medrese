// Calendar dates as plain "YYYY-MM-DD" strings in the device's local time (Asia/Bishkek for the madrasa).
// Never Date.toISOString(): it is UTC, which in Bishkek (UTC+6) is still "yesterday" until 06:00, and
// turns a local midnight (first day of a month or year) into the previous day.
const pad = (n: number) => String(n).padStart(2, "0");

export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayIso = () => isoOf(new Date());
