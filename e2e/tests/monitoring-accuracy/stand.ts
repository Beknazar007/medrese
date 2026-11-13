// What e2e/fixtures/seed.py put on the stand for monitoring-accuracy (E2E_EXTRA_DATA=1) and helpers
// shared by the role files. Names here must match seed.py.
//
// «Бейшеев Тилек» (Хафиздик бөлүмү, the dean's department) has two weekly lessons on pair 3 (11:00–12:20):
//   «Тажвид» · «Даярдоо 1»: the latest date — opened 12 min late, pupils marked, finished at 11:30 (before
//     half time); the one before — no pupils marked; the third — no pupils marked and finished at 11:20;
//   «Хифз» · «Хафиз 1»: the latest date — opened without attendance, the group has hifz scores that day;
//     the third — the same, but no hifz scores (older than the seeded two weeks of scores);
//   every other date since 01.09 is a missed lesson.
// Stand times of the older seeded lessons are shifted by +6 h (seed stores Bishkek wall clock, the app
// reads it as UTC), and pair 1 starts at 00:00 — so almost every seeded lesson is «Кечиккен». Tests
// never expect a fixed number of late lessons except for «Бейшеев Тилек», whose times are correct.
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { API_URL, expect, tr } from "../../fixtures/app";
import { USERS } from "../../fixtures/users";
import { apiLogin, bishkekToday } from "../ux-fixes-2/stand";

export { apiLogin, bishkekToday, expectNoPageScrollX, question } from "../ux-fixes-2/stand";

export const T6 = "Бейшеев Тилек";
export const T6_GROUP = "Даярдоо 1";
export const T6_HAFIZ_GROUP = "Хафиз 1";
export const MAMYTOV = USERS.teacher.fullName;
export const HAFIZ_TEACHER = USERS.hafiz.fullName;
export const HAFIZ_DEPARTMENT = "Хафиздик бөлүмү";
export const ILIM_DEPARTMENT = "Илим бөлүмү";
/** Seeded semester «2026 Күз»: 01.09–31.12.2026 (backend/tests/factories.py make_semester). */
export const SEMESTER_START = "2026-09-01";

/** lib/palette.ts STATUS_FILL as the browser reports it: ≥ 90 % green, 70–89 % yellow, < 70 % red. */
export const PERCENT_RGB = { good: "rgb(12, 163, 12)", warning: "rgb(250, 178, 25)", bad: "rgb(208, 59, 59)" };
export function percentRgb(percent: number): string {
  return percent >= 90 ? PERCENT_RGB.good : percent >= 70 ? PERCENT_RGB.warning : PERCENT_RGB.bad;
}

/** Same rounding as the server: half up. */
export function percentOf(conducted: number, expected: number): number | null {
  return expected === 0 ? null : Math.floor((conducted * 200 + expected) / (2 * expected));
}

export type LogRow = {
  date: string;
  schedule_entry_id: number;
  group_name: string;
  status: "CONDUCTED" | "CONDUCTED_BY_MARK" | "MISSED" | "EXCUSED" | "CANCELLED";
  late: boolean;
  can_mark: boolean;
  no_student_marks: boolean;
  early_finish: boolean;
  mark: { id: number } | null;
};

/** Rector's or dean's API, for looking things up and for putting the stand back after a test. */
export async function staffApi(request: APIRequestContext, username = "rector") {
  const headers = await apiLogin(request, username);
  const get = async <T>(path: string) => {
    const res = await request.get(`${API_URL}${path}`, { headers });
    expect(res.status(), `GET ${path}`).toBe(200);
    return (await res.json()) as T;
  };
  const semesterId = (await get<{ id: number; is_active: boolean }[]>("/semesters")).find((s) => s.is_active)!.id;
  const teacherId = async (name: string) =>
    (await get<{ id: number; full_name: string }[]>("/teachers")).find((t) => t.full_name === name)!.id;
  const log = async (teacherId: number, from = SEMESTER_START, to = bishkekToday()) =>
    get<LogRow[]>(`/monitoring/teachers/${teacherId}/sessions?semester_id=${semesterId}&date_from=${from}&date_to=${to}`);
  const nonWorkingDays = () => get<{ id: number; name: string }[]>("/non-working-days");
  return { headers, get, semesterId, teacherId, log, nonWorkingDays };
}

/** Oldest-first missed lessons of one group in a teacher's log. */
export function missed(rows: LogRow[], group: string): LogRow[] {
  return rows.filter((r) => r.status === "MISSED" && r.group_name === group).sort((a, b) => a.date.localeCompare(b.date));
}

/** Goes to a screen through the menu (no reload) and waits until that screen is drawn: the routes are lazy,
 *  so right after the click the previous screen and its date fields are still on the page. */
export async function goViaMenu(page: Page, screen: "monitoring" | "dashboard" | "non_working_days" | "timeslots") {
  const where = {
    monitoring: { link: "nav.monitoring", url: /\/monitoring$/, heading: "monitoring.title" },
    dashboard: { link: "nav.dashboard", url: /\/dashboard$/, heading: "dashboard.teacher_workload" },
    non_working_days: { link: "nav.non_working_days", url: /\/non-working-days$/, heading: "non_working_days.title" },
    timeslots: { link: "nav.timeslots", url: /\/timeslots$/, heading: "timeslots.title" },
  }[screen];
  await page.getByRole("link", { name: tr(where.link), exact: true }).click();
  await expect(page).toHaveURL(where.url);
  await expect(page.getByRole("heading", { name: tr(where.heading), exact: true })).toBeVisible();
}

/** Sets the period with the two date fields of DateRangePicker and waits for the figures of exactly that period
 *  — on a computer until the table shows them, not the previous period's. */
export async function setPeriod(page: Page, from: string, to: string, path = "/monitoring/teachers"): Promise<any> {
  const loaded = page.waitForResponse(
    (r) => r.url().includes(`${path}?`) && r.url().includes(`date_from=${from}`) && r.url().includes(`date_to=${to}`),
  );
  await page.getByLabel(tr("monitoring.range_from")).fill(from);
  await page.getByLabel(tr("monitoring.range_to")).fill(to);
  const body = await (await loaded).json();
  if (path !== "/monitoring/teachers" || (page.viewportSize()?.width ?? 0) < 600) return body;
  const rows = body as { full_name: string; expected_lessons: number; conducted_lessons: number }[];
  const shown = (list: { name: string; expected: number; conducted: number }[]) =>
    list.map((r) => `${r.name}:${r.expected}:${r.conducted}`).join("|");
  await expect
    .poll(async () => shown(await readMonitoringTable(page)))
    .toBe(shown(rows.map((r) => ({ name: r.full_name, expected: r.expected_lessons, conducted: r.conducted_lessons }))));
  return body;
}

export type MonitoringRow = {
  name: string;
  department: string;
  expected: number;
  conducted: number;
  missed: number;
  late: number;
  attention: number;
  percent: number | null;
};

/** The «Мониторинг» table on a computer, read as the user sees it. */
export async function readMonitoringTable(page: Page): Promise<MonitoringRow[]> {
  const rows = page.getByRole("table").getByRole("row");
  const out: MonitoringRow[] = [];
  for (const row of await rows.all()) {
    const cells = await row.getByRole("cell").allInnerTexts();
    if (cells.length !== 7) continue; // the header row has column headers, not cells
    const [who, ...nums] = cells;
    const [name, department] = who.split("\n").map((s) => s.trim()).filter(Boolean);
    const [expected, conducted, missedN, late, attention] = nums.slice(0, 5).map((s) => Number(s.trim()));
    const percentText = nums[5].trim();
    out.push({
      name,
      department,
      expected,
      conducted,
      missed: missedN,
      late,
      attention,
      percent: percentText === "—" ? null : Number(percentText.replace("%", "")),
    });
  }
  return out;
}

export async function teacherRow(page: Page, name: string): Promise<MonitoringRow> {
  // A closing dialog keeps the page aria-hidden for a moment; wait until the table is readable again.
  await expect(page.getByRole("row").filter({ hasText: name }).first()).toBeVisible();
  const row = (await readMonitoringTable(page)).find((r) => r.name === name);
  if (!row) throw new Error(`${name} is not in the monitoring table`);
  return row;
}

/** Opens «Сабактар: {name}» by clicking the teacher, as the rector does. */
export async function openLog(page: Page, name: string): Promise<Locator> {
  await page.getByRole("row").filter({ hasText: name }).first().click();
  const dialog = page.getByRole("dialog").filter({ hasText: tr("monitoring.log_title").replace("{{name}}", name) });
  await expect(dialog).toBeVisible();
  return dialog;
}

export function logRow(dialog: Locator, date: string, group: string): Locator {
  return dialog.getByRole("row").filter({ hasText: date }).filter({ hasText: group });
}

export function markDialog(page: Page): Locator {
  return page.getByRole("dialog").filter({ has: page.getByRole("radio") });
}

/** A dashboard tile: the deepest box holding its label (StatTile = label + value). */
export function dashboardTile(page: Page, labelKey: string): Locator {
  return page.locator("div").filter({ has: page.getByText(tr(labelKey), { exact: true }) }).last();
}

/** The figure on a dashboard tile, as text ("116", "25%", "—"). */
export async function tileValue(page: Page, labelKey: string): Promise<string> {
  const text = await dashboardTile(page, labelKey).innerText();
  return text.replace(tr(labelKey), "").trim();
}
