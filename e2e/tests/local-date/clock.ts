/** Today's calendar date in Bishkek and the moment 02:30 of that day — a time when UTC still shows yesterday. */
export function bishkekNightClock(): { today: string; at: Date } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bishkek" }).format(new Date()); // YYYY-MM-DD
  return { today, at: new Date(`${today}T02:30:00+06:00`) };
}
