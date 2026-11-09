// One palette for the whole app, so "present / late / excused / absent" and the chart colors
// look the same on every page. Fills are for bars, dots and chip backgrounds; `ink` versions are
// readable as text on the current theme (light or dark).

export type AttendanceKey = "present" | "late" | "excused" | "absent";

export const STATUS_FILL: Record<AttendanceKey, string> = {
  present: "#0ca30c",
  late: "#fab219",
  excused: "#2a78d6",
  absent: "#d03b3b",
};

/** Solid status colors with white text on them (attendance buttons). Same in both themes. */
export const STATUS_SOLID: Record<AttendanceKey, string> = {
  present: "#2e7d32",
  late: "#a86400",
  excused: "#1565c0",
  absent: "#c62828",
};

// Colors used as text or thin tracks depend on the theme: dark ink on a light page, light ink at
// night. They are CSS variables, set per theme in ColorModeProvider from these tables.
const MODE_VARS = {
  light: {
    "--ink-present": STATUS_SOLID.present,
    "--ink-late": STATUS_SOLID.late,
    "--ink-excused": STATUS_SOLID.excused,
    "--ink-absent": STATUS_SOLID.absent,
    "--ink-neutral": "#1b1b1b",
    "--track": "#eae9e6",
    "--tint-absent": "rgba(198,40,40,.06)",
    "--tint-late": "rgba(224,134,0,.08)",
  },
  dark: {
    "--ink-present": "#6cc070",
    "--ink-late": "#f2b25a",
    "--ink-excused": "#74b0f0",
    "--ink-absent": "#f07070",
    "--ink-neutral": "#ececec",
    "--track": "#2e3238",
    "--tint-absent": "rgba(240,112,112,.12)",
    "--tint-late": "rgba(242,178,90,.12)",
  },
} as const;

export function paletteCssVars(mode: "light" | "dark"): Record<string, string> {
  return MODE_VARS[mode];
}

/** Status colors that are readable as text on the current theme's background. */
export const STATUS_INK: Record<AttendanceKey, string> = {
  present: "var(--ink-present)",
  late: "var(--ink-late)",
  excused: "var(--ink-excused)",
  absent: "var(--ink-absent)",
};

/** Tone colors for numbers: good / warning / bad, readable as text. */
export const TONE_INK = {
  neutral: "var(--ink-neutral)",
  good: STATUS_INK.present,
  warning: STATUS_INK.late,
  bad: STATUS_INK.absent,
} as const;

export const CHART_BLUE = STATUS_FILL.excused;
export const TRACK = "var(--track)";

/** Distinct colors for groups on the timetable. */
export const GROUP_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

/** Black or white text, whichever reads better on `hex` (WCAG relative luminance). */
export function textOn(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contrast against white is 1.05/(l+0.05); against black (l+0.05)/0.05 — pick the larger.
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? "#fff" : "rgba(0,0,0,0.87)";
}

/** A chip / badge style with a status fill and readable text. */
export function filledSx(hex: string) {
  return { bgcolor: hex, color: textOn(hex) };
}
