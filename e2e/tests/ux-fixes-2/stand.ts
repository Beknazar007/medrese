// What e2e/fixtures/seed.py put on the stand for ux-fixes-2 (E2E_EXTRA_DATA=1) and helpers shared
// by the role files. Names here must match seed.py.
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { API_URL, expect, tr, type Lang } from "../../fixtures/app";
import { PASSWORD } from "../../fixtures/users";

export const LANGS: Lang[] = ["ky", "ru", "en"];
export const STATUSES = ["present", "absent", "late", "excused"] as const;
export type Status = (typeof STATUSES)[number];

/** Letters per language, in button order (spec, table in B7; decisions 1–2). */
export const LETTERS: Record<Lang, string[]> = {
  ky: ["К", "Ж", "О", "С"],
  ru: ["П", "Н", "О", "У"],
  en: ["P", "A", "L", "E"],
};

/** Selected-button background, lib/palette.ts STATUS_SOLID. */
export const SOLID_RGB: Record<Status, string> = {
  present: "rgb(46, 125, 50)",
  absent: "rgb(198, 40, 40)",
  late: "rgb(168, 100, 0)",
  excused: "rgb(21, 101, 192)",
};

// seed.py: «Мамытов Азамат» teaches «Фикх» to «Кары 1» today; «Сатыбалдиев Аким» is excused today.
export const CLASS_STUDENT = "Асанов Эмир";
export const CLASS_STUDENT_2 = "Бакиров Нурислам";
export const CLASS_EXCUSED = { name: "Сатыбалдиев Аким", reason: "Үй-бүлөлүк себеп (e2e)" };
// seed.py: «Хафиз 1» today; «Сыдыков Билал» excused; «Токтогулов Умар» has the fixed-date plan and exam.
export const HAFIZ_STUDENT = "Осмонов Абдулла";
export const HAFIZ_DATED = "Токтогулов Умар";
export const HAFIZ_EXCUSED = { name: "Сыдыков Билал", reason: "Ооруканада (e2e)" };
export const DATED_PLAN = { start: "2026-10-27", end: "2026-11-16", shown: "27.10.2026 — 16.11.2026" };
export const DATED_EXAM = { title: "2-жуз (e2e)", shown: "05.11.2026" };

/** A unique suffix, so records created by the mobile and desktop runs never collide. */
export function uniq(): string {
  return `${Date.now() % 1_000_000}${Math.floor(Math.random() * 100)}`;
}

/** The full word of a status, i.e. the button's accessible name. */
export function statusLabel(status: Status, lang: Lang = "ky"): string {
  return tr(`journal.attendance_${status}`, lang);
}

export function statusButton(scope: Locator, status: Status, lang: Lang = "ky"): Locator {
  return scope.getByRole("button", { name: statusLabel(status, lang), exact: true });
}

/** One student's attendance block: a card on a phone, a table row on a computer. */
export function studentBlock(page: Page, isMobile: boolean, name: string, lang: Lang = "ky"): Locator {
  if (!isMobile) return page.getByRole("row").filter({ hasText: name }).first();
  // The deepest box holding both the name and the buttons is the student's card.
  return page
    .locator("div")
    .filter({ hasText: name })
    .filter({ has: page.getByRole("button", { name: statusLabel("present", lang), exact: true }) })
    .last();
}

/** The "Save changes?"/"Delete?" question of ConfirmContext. */
export function question(page: Page, lang: Lang = "ky"): Locator {
  return page.getByRole("dialog").filter({ hasText: tr("common.confirm_title", lang) });
}

/** Collects requests of one method whose URL matches — to prove what did or did not reach the server. */
export function track(page: Page, method: string, url: RegExp): string[] {
  const hits: string[] = [];
  page.on("request", (r) => {
    if (r.method() === method && url.test(r.url())) hits.push(r.url());
  });
  return hits;
}

/** Switches the interface language the way a person does: header select, or the menu on a phone. */
export async function switchLanguage(page: Page, isMobile: boolean, to: Lang) {
  const names: Record<Lang, string> = { ky: "Кыргызча", ru: "Русский", en: "English" };
  const anyLang = /^(Кыргызча|Русский|English)$/;
  if (isMobile) {
    await page.getByRole("button", { name: /^(Меню|Menu)$/ }).click();
  }
  await page.getByRole("combobox").filter({ hasText: anyLang }).click();
  await page.getByRole("option", { name: names[to], exact: true }).click();
  if (isMobile) await page.keyboard.press("Escape");
}

/** Bearer header of a stand user, logged in through the API (no browser). */
export async function apiLogin(request: APIRequestContext, username: string): Promise<Record<string, string>> {
  const login = await request.post(`${API_URL}/auth/login`, { form: { username, password: PASSWORD } });
  expect(login.ok()).toBeTruthy();
  return { Authorization: `Bearer ${(await login.json()).access_token}` };
}

/** Rector's view of the stand, to look up ids by name and to create test data. */
export async function rectorApi(request: APIRequestContext) {
  const headers = await apiLogin(request, "rector");
  const list = async <T>(path: string) => (await (await request.get(`${API_URL}${path}`, { headers })).json()) as T;
  const post = async <T>(path: string, data: unknown) => {
    const res = await request.post(`${API_URL}${path}`, { headers, data });
    expect(res.status(), `POST ${path}: ${await res.text()}`).toBe(201);
    return (await res.json()) as T;
  };
  const departmentId = async (name: string) =>
    (await list<{ id: number; name: string }[]>("/departments")).find((d) => d.name === name)!.id;
  const teacherId = async (name: string) =>
    (await list<{ id: number; full_name: string }[]>("/teachers")).find((t) => t.full_name === name)!.id;
  const studentId = async (name: string) =>
    (await list<{ id: number; full_name: string }[]>("/students")).find((s) => s.full_name === name)!.id;
  const activeSemesterId = async () =>
    (await list<{ id: number; is_active: boolean }[]>("/semesters")).find((s) => s.is_active)!.id;
  return { headers, list, post, departmentId, teacherId, studentId, activeSemesterId };
}

/** Weekdays seed.py uses for lessons other than today's: d1, d2, d3 (Mon–Sat, today skipped). */
export function standDays(): [number, number, number] {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bishkek", weekday: "short" }).format(new Date());
  const today = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday) + 1;
  const days = [1, 2, 3, 4, 5, 6].filter((d) => d !== today);
  return [days[0], days[1], days[2]];
}

/** Today in Bishkek as YYYY-MM-DD (the stand's "today"). */
export function bishkekToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bishkek" }).format(new Date());
}

/** Button sizes, font size and right edge, measured as the user sees them. */
export async function measureButtons(scope: Locator, lang: Lang = "ky") {
  const out: { status: Status; width: number; height: number; right: number; fontSize: number }[] = [];
  for (const status of STATUSES) {
    const button = statusButton(scope, status, lang);
    const box = await button.boundingBox();
    if (!box) throw new Error(`no box for ${status}`);
    const fontSize = await button.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    out.push({ status, width: box.width, height: box.height, right: box.x + box.width, fontSize });
  }
  return out;
}

/** No horizontal scroll of the whole page. */
export async function expectNoPageScrollX(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.scrollingElement!.scrollWidth,
    client: document.scrollingElement!.clientWidth,
  }));
  expect(scroll, "page scrolls sideways").toBeLessThanOrEqual(client);
}
