// monitoring-accuracy — декан (заведует «Хафиздик бөлүмү»): видит только своё отделение (1.15, 1.16),
// ставит и снимает отметки своим учителям (2.24), не может чужим (2.25), не управляет нерабочими днями
// и порогом опоздания (2.26, 2.27). Спека: specs/monitoring-accuracy.md. Данные — e2e/fixtures/seed.py.
import { API_URL, authHeader, expect, loginAs, test, tr } from "../../fixtures/app";
import {
  HAFIZ_DEPARTMENT,
  HAFIZ_TEACHER,
  MAMYTOV,
  SEMESTER_START,
  T6,
  T6_GROUP,
  bishkekToday,
  goViaMenu,
  logRow,
  markDialog,
  missed,
  openLog,
  percentOf,
  question,
  readMonitoringTable,
  setPeriod,
  staffApi,
  teacherRow,
  tileValue,
} from "./stand";

const ROLE = "dean" as const;
const TODAY = bishkekToday();

test.describe(`monitoring-accuracy — ${ROLE}`, () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ROLE);
  });

  test.describe("компьютер", () => {
    test.skip(({ isMobile }) => isMobile, "«Мониторинг» и главная декана — экран руководства, компьютер");

    test("AC-1.15, AC-1.11, AC-1.12, AC-2.20: в «Мониторинге» и на главной — только учителя и суммы «Хафиздик бөлүмү»", async ({ page }) => {
      await page.goto("/monitoring");
      await setPeriod(page, SEMESTER_START, TODAY);
      const rows = await readMonitoringTable(page);
      expect(rows.map((r) => r.name).sort()).toEqual([HAFIZ_TEACHER, T6].sort());
      for (const r of rows) expect(r.department, r.name).toBe(HAFIZ_DEPARTMENT);
      await expect(page.getByText(MAMYTOV, { exact: true })).toHaveCount(0);

      const sum = (k: "expected" | "conducted" | "missed" | "late" | "attention") => rows.reduce((s, r) => s + r[k], 0);
      await goViaMenu(page, "dashboard");
      await setPeriod(page, SEMESTER_START, TODAY, "/dashboard/teacher-monitoring-summary");
      await expect.poll(() => tileValue(page, "monitoring.col_expected")).toBe(String(sum("expected")));
      await expect.poll(() => tileValue(page, "monitoring.col_conducted")).toBe(String(sum("conducted")));
      await expect.poll(() => tileValue(page, "monitoring.col_missed")).toBe(String(sum("missed")));
      await expect.poll(() => tileValue(page, "monitoring.col_late")).toBe(String(sum("late")));
      await expect.poll(() => tileValue(page, "monitoring.col_attention")).toBe(String(sum("attention")));
      await expect.poll(() => tileValue(page, "monitoring.col_percent")).toBe(`${percentOf(sum("conducted"), sum("expected"))}%`);
      await expect(page.getByText(MAMYTOV, { exact: true })).toHaveCount(0);
    });

    test("AC-2.24: декан ставит, меняет и снимает отметку у урока своего учителя", async ({ page, request }) => {
      const rector = await staffApi(request);
      // Not the lesson the rector's test marks, so a leftover from one never breaks the other.
      const target = missed(await rector.log(await rector.teacherId(T6)), T6_GROUP)[1];
      try {
        await page.goto("/monitoring");
        await setPeriod(page, SEMESTER_START, TODAY);
        const before = await teacherRow(page, T6);

        let dialog = await openLog(page, T6);
        await logRow(dialog, target.date, T6_GROUP).getByRole("button", { name: tr("monitoring.mark_reason") }).click();
        let mark = markDialog(page);
        await mark.getByRole("radio", { name: tr("monitoring.reason_cancelled"), exact: true }).check();
        await mark.getByRole("button", { name: tr("common.save") }).click();
        await expect(mark).toHaveCount(0);
        const row = logRow(dialog, target.date, T6_GROUP);
        await expect(row.getByText(tr("monitoring.reason_cancelled"), { exact: true }).first()).toBeVisible();
        await expect(row.getByText(/^Белгилеген: dean, /)).toBeVisible();
        await dialog.getByRole("button", { name: tr("common.close") }).click();
        await expect.poll(() => teacherRow(page, T6)).toMatchObject({ expected: before.expected - 1, missed: before.missed - 1 });

        // Change to «forgot to open», then remove.
        dialog = await openLog(page, T6);
        await logRow(dialog, target.date, T6_GROUP).getByRole("button", { name: tr("monitoring.mark_reason") }).click();
        mark = markDialog(page);
        await mark.getByRole("radio", { name: tr("monitoring.reason_forgot"), exact: true }).check();
        await mark.getByRole("button", { name: tr("common.save") }).click();
        await expect(mark).toHaveCount(0);
        await expect(logRow(dialog, target.date, T6_GROUP).getByText(tr("monitoring.status_conducted_by_mark"), { exact: true })).toBeVisible();
        await logRow(dialog, target.date, T6_GROUP).getByRole("button", { name: tr("monitoring.mark_reason") }).click();
        mark = markDialog(page);
        await mark.getByRole("button", { name: tr("monitoring.remove_mark") }).click();
        await question(page).getByRole("button", { name: tr("monitoring.remove_mark") }).click();
        await expect(mark).toHaveCount(0);
        await expect(logRow(dialog, target.date, T6_GROUP).getByText(tr("monitoring.status_missed"), { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: tr("common.close") }).click();
        await expect.poll(() => teacherRow(page, T6)).toEqual(before);
      } finally {
        const left = (await rector.log(await rector.teacherId(T6))).find((r) => r.date === target.date && r.mark);
        if (left) await request.delete(`${API_URL}/monitoring/lesson-marks/${left.mark!.id}`, { headers: rector.headers });
      }
    });
  });

  test("AC-1.16, AC-2.25: учитель «Илим бөлүмү» — журнал по дням 403, поставить и снять отметку 403", async ({ page, request }) => {
    const rector = await staffApi(request);
    const mamytovId = await rector.teacherId(MAMYTOV);
    const foreign = (await rector.log(mamytovId)).find((r) => r.status === "MISSED")!;
    expect(foreign).toBeTruthy();
    const headers = await authHeader(page);

    const logRes = await page.request.get(
      `${API_URL}/monitoring/teachers/${mamytovId}/sessions?semester_id=${rector.semesterId}&date_from=${SEMESTER_START}&date_to=${TODAY}`,
      { headers },
    );
    expect(logRes.status()).toBe(403);
    const put = await page.request.put(`${API_URL}/monitoring/lesson-marks`, {
      headers,
      data: { schedule_entry_id: foreign.schedule_entry_id, date: foreign.date, kind: "CANCELLED" },
    });
    expect(put.status()).toBe(403);

    // A mark the rector put on the foreign lesson can't be removed by the dean either.
    const byRector = await request.put(`${API_URL}/monitoring/lesson-marks`, {
      headers: rector.headers,
      data: { schedule_entry_id: foreign.schedule_entry_id, date: foreign.date, kind: "EXCUSED" },
    });
    expect(byRector.status()).toBe(200);
    const markId = (await byRector.json()).id as number;
    try {
      expect((await page.request.delete(`${API_URL}/monitoring/lesson-marks/${markId}`, { headers })).status()).toBe(403);
    } finally {
      expect((await request.delete(`${API_URL}/monitoring/lesson-marks/${markId}`, { headers: rector.headers })).status()).toBe(204);
    }
  });

  test("AC-2.26: декан не видит «Иш эмес күндөр», прямой адрес уводит, изменения — 403", async ({ page, request, isMobile }) => {
    if (isMobile) await page.getByRole("button", { name: tr("nav.menu") }).click();
    await expect(page.getByRole("link", { name: tr("nav.monitoring"), exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: tr("nav.non_working_days") })).toHaveCount(0);
    if (isMobile) await page.keyboard.press("Escape");
    await page.goto("/non-working-days");
    await expect(page).toHaveURL(/\/schedule$/);

    const headers = await authHeader(page);
    const create = await page.request.post(`${API_URL}/non-working-days`, {
      headers,
      data: { name: "Декандын майрамы", start_date: "2026-12-01", end_date: "2026-12-01" },
    });
    expect(create.status()).toBe(403);
    // Change and delete a day the rector made.
    const rector = await staffApi(request);
    const made = await request.post(`${API_URL}/non-working-days`, {
      headers: rector.headers,
      data: { name: "Ректордун күнү (e2e)", start_date: "2026-12-02", end_date: "2026-12-02" },
    });
    expect(made.status()).toBe(201);
    const id = (await made.json()).id as number;
    try {
      expect((await page.request.patch(`${API_URL}/non-working-days/${id}`, { headers, data: { name: "x" } })).status()).toBe(403);
      expect((await page.request.delete(`${API_URL}/non-working-days/${id}`, { headers })).status()).toBe(403);
    } finally {
      await request.delete(`${API_URL}/non-working-days/${id}`, { headers: rector.headers });
    }
  });

  test("AC-2.27: декан не видит «Сабак убактылары» и порог опоздания, изменить порог — 403", async ({ page, isMobile }) => {
    if (isMobile) await page.getByRole("button", { name: tr("nav.menu") }).click();
    await expect(page.getByRole("link", { name: tr("nav.monitoring"), exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: tr("nav.timeslots") })).toHaveCount(0);
    if (isMobile) await page.keyboard.press("Escape");
    await page.goto("/timeslots");
    await expect(page).toHaveURL(/\/schedule$/);
    await expect(page.getByLabel(tr("timeslots.late_threshold"))).toHaveCount(0);
    const res = await page.request.patch(`${API_URL}/settings`, {
      headers: await authHeader(page),
      data: { late_threshold_minutes: 30 },
    });
    expect(res.status()).toBe(403);
  });
});
