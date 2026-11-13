// What a teacher (ordinary or hafiz) must not reach after monitoring-accuracy: spec 1.17 and 2.29.
// Shared by teacher.spec.ts and hafiz.spec.ts — the rules are the same for both.
import type { APIResponse, Page } from "@playwright/test";
import { API_URL, authHeader, expect, tr } from "../../fixtures/app";
import { SEMESTER_START, bishkekToday } from "./stand";

/** Menu without «Мониторинг», «Башкы бет» and «Иш эмес күндөр»; the addresses lead to /schedule. */
export async function expectNoStaffScreens(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole("button", { name: tr("nav.menu") }).click();
  await expect(page.getByRole("link", { name: tr("nav.schedule") })).toBeVisible();
  await expect(page.getByRole("link", { name: tr("nav.monitoring"), exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: tr("nav.non_working_days") })).toHaveCount(0);
  await expect(page.getByRole("link", { name: tr("nav.dashboard") })).toHaveCount(0);
  if (isMobile) await page.keyboard.press("Escape");
  for (const path of ["/monitoring", "/non-working-days", "/dashboard", "/timeslots"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/schedule$/);
  }
  await expect(page.getByText(tr("monitoring.col_attention"), { exact: true })).toHaveCount(0);
}

/** Every monitoring, dashboard, non-working-day, settings and lesson-mark address answers 403. */
export async function expectStaffApiForbidden(page: Page) {
  const headers = await authHeader(page);
  const period = `semester_id=1&date_from=${SEMESTER_START}&date_to=${bishkekToday()}`;
  const calls: [string, () => Promise<APIResponse>][] = [
    ["GET /monitoring/teachers", () => page.request.get(`${API_URL}/monitoring/teachers?${period}`, { headers })],
    ["GET /monitoring/teachers/1/sessions", () => page.request.get(`${API_URL}/monitoring/teachers/1/sessions?${period}`, { headers })],
    ["GET /dashboard/teacher-monitoring-summary", () => page.request.get(`${API_URL}/dashboard/teacher-monitoring-summary?${period}`, { headers })],
    ["GET /dashboard/student-attendance-summary", () => page.request.get(`${API_URL}/dashboard/student-attendance-summary?${period}`, { headers })],
    ["GET /non-working-days", () => page.request.get(`${API_URL}/non-working-days`, { headers })],
    [
      "POST /non-working-days",
      () =>
        page.request.post(`${API_URL}/non-working-days`, {
          headers,
          data: { name: "x", start_date: "2026-12-01", end_date: "2026-12-01" },
        }),
    ],
    ["PATCH /non-working-days/1", () => page.request.patch(`${API_URL}/non-working-days/1`, { headers, data: { name: "x" } })],
    ["DELETE /non-working-days/1", () => page.request.delete(`${API_URL}/non-working-days/1`, { headers })],
    ["GET /settings", () => page.request.get(`${API_URL}/settings`, { headers })],
    ["PATCH /settings", () => page.request.patch(`${API_URL}/settings`, { headers, data: { late_threshold_minutes: 30 } })],
    [
      "PUT /monitoring/lesson-marks",
      () =>
        page.request.put(`${API_URL}/monitoring/lesson-marks`, {
          headers,
          data: { schedule_entry_id: 1, date: SEMESTER_START, kind: "EXCUSED" },
        }),
    ],
    ["DELETE /monitoring/lesson-marks/1", () => page.request.delete(`${API_URL}/monitoring/lesson-marks/1`, { headers })],
  ];
  for (const [name, call] of calls) {
    expect((await call()).status(), name).toBe(403);
  }
}
