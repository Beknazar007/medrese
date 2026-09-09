export type RangePreset = "day" | "week" | "month" | "year";

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeRange(preset: RangePreset): { from: string; to: string } {
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
