// monitoring-accuracy — ректор: подсчёт «Мониторинга» (шаг 1), нерабочие дни, отметки причин,
// «Көңүл буруу керек» и порог опоздания (шаг 2). Спека: specs/monitoring-accuracy.md, план — раздел e2e.
// Данные — e2e/fixtures/seed.py (см. tests/monitoring-accuracy/stand.ts). Сценарии с точным временем
// (1.2, 1.9) и замена учителя (2.15) проверены в pytest: часы стенда настоящие.
// Тесты, меняющие общие данные (нерабочий день, отметка, порог), сами возвращают всё назад (finally) и идут
// по порядку: в playwright.config.ts один воркер и fullyParallel: false. Без describe.serial — чтобы одна
// упавшая проверка не отменяла остальные критерии.
import type { Locator, Page } from "@playwright/test";
import { API_URL, expect, loginAs, test, tr } from "../../fixtures/app";
import {
  MAMYTOV,
  SEMESTER_START,
  T6,
  T6_GROUP,
  T6_HAFIZ_GROUP,
  bishkekToday,
  goViaMenu,
  expectNoPageScrollX,
  logRow,
  markDialog,
  missed,
  openLog,
  percentOf,
  percentRgb,
  question,
  readMonitoringTable,
  setPeriod,
  staffApi,
  teacherRow,
  tileValue,
} from "./stand";

const ROLE = "rector" as const;
const TODAY = bishkekToday();

/** «Сактоо» next to the threshold; the server's answer is the proof (the form is redrawn with the new value). */
async function saveThreshold(page: Page, save: Locator, minutes: number) {
  const saved = page.waitForResponse((r) => r.url().endsWith("/settings") && r.request().method() === "PATCH");
  await save.click();
  const res = await saved;
  expect(res.status()).toBe(200);
  expect((await res.json()).late_threshold_minutes).toBe(minutes);
  await expect(page.getByLabel(tr("timeslots.late_threshold"))).toHaveValue(String(minutes));
}

/** «Күн» preset, waiting for today's figures. */
async function pickDay(page: Page) {
  const loaded = page.waitForResponse((r) => r.url().includes(`/monitoring/teachers?`) && r.url().includes(`date_from=${TODAY}&date_to=${TODAY}`));
  await page.getByRole("button", { name: tr("monitoring.range_day"), exact: true }).click();
  await loaded;
}

test.describe(`monitoring-accuracy — ${ROLE}`, () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ROLE);
  });

  test.describe("компьютер", () => {
    test.skip(({ isMobile }) => isMobile, "таблица «Мониторинга» и справочники — экран руководства, компьютер; телефон — ниже");

    test("AC-1.1, AC-1.3: идущая пара не входит в план, а открытый сегодня урок входит в план и в проведённые", async ({
      page,
      browser,
    }) => {
      // Pair 1 runs all day on the stand, so none of today's lessons has ended yet.
      await page.goto("/monitoring");
      await pickDay(page);
      await expect(page.getByLabel(tr("monitoring.range_from"))).toHaveValue(TODAY);
      for (const row of await readMonitoringTable(page)) {
        expect(row.missed, `${row.name}: today's running pair is not missed`).toBe(0);
        expect(row.expected, `${row.name}: only opened lessons are expected today`).toBe(row.conducted);
      }

      // The teacher opens today's lesson in «Менин классым», as before.
      const teacherPage = await browser.newPage();
      await loginAs(teacherPage, "teacher");
      await teacherPage.goto("/my-class");
      await expect(teacherPage.getByRole("button", { name: tr("journal.mark_all_present") })).toBeVisible();
      await teacherPage.close();

      await page.reload();
      await pickDay(page);
      await expect(page.getByRole("row").filter({ hasText: MAMYTOV })).toBeVisible();
      const mamytov = await teacherRow(page, MAMYTOV);
      expect(mamytov.expected).toBeGreaterThanOrEqual(1);
      expect(mamytov.conducted).toBe(mamytov.expected);
      expect(mamytov.missed).toBe(0);
      expect(mamytov.percent).toBe(100);
    });

    test("AC-1.4: период 25.08–07.09 обрезается началом семестра 01.09", async ({ page }) => {
      await page.goto("/monitoring");
      await setPeriod(page, "2026-08-25", "2026-09-07");
      // 01.09–07.09 holds each weekday once: one lesson of each of the two weekly entries.
      const row = await teacherRow(page, T6);
      expect(row).toMatchObject({ expected: 2, conducted: 0, missed: 2 });
      const dialog = await openLog(page, T6);
      const dates = await dialog.getByRole("row").filter({ hasText: /2026-\d\d-\d\d/ }).allInnerTexts();
      expect(dates).toHaveLength(2);
      for (const text of dates) expect(text.slice(0, 10) >= SEMESTER_START, text).toBe(true);
    });

    test("AC-1.5: период целиком до семестра — пустая таблица и сообщение «вне семестра»", async ({ page }) => {
      await page.goto("/monitoring");
      await setPeriod(page, "2026-08-01", "2026-08-31");
      await expect(page.getByText(tr("monitoring.out_of_semester"), { exact: true })).toBeVisible();
      await expect(page.getByRole("table")).toHaveCount(0);
    });

    test("AC-1.6, AC-1.7, AC-1.8: колонка «Өткөрүлгөн %», порядок от худшего процента и цвета чипов", async ({ page }) => {
      await page.goto("/monitoring");
      await setPeriod(page, SEMESTER_START, TODAY);
      const header = page.getByRole("table").getByRole("row").first();
      await expect(header.getByRole("columnheader", { name: tr("monitoring.col_percent"), exact: true })).toBeVisible();
      await expect(header.getByRole("columnheader", { name: tr("monitoring.col_late"), exact: true })).toBeVisible();
      await expect(header.getByRole("columnheader", { name: "Көрсөткүч", exact: true })).toHaveCount(0);

      const rows = await readMonitoringTable(page);
      expect(rows.length).toBeGreaterThan(2);
      for (const r of rows) {
        expect(r.missed, r.name).toBe(r.expected - r.conducted);
        expect(r.percent, `${r.name}: ${r.conducted}/${r.expected}`).toBe(percentOf(r.conducted, r.expected));
      }
      // 1.7: percent ascending, then more misses first, then by name; "—" last.
      const sorted = [...rows].sort(
        (a, b) =>
          Number(a.percent === null) - Number(b.percent === null) ||
          (a.percent ?? 0) - (b.percent ?? 0) ||
          b.missed - a.missed ||
          a.name.localeCompare(b.name, "ky"),
      );
      expect(rows.map((r) => r.name)).toEqual(sorted.map((r) => r.name));
      // 1.6: a teacher with a lower percent stands higher whatever the number of lessons.
      const t6 = rows.findIndex((r) => r.name === T6);
      const mamytov = rows.findIndex((r) => r.name === MAMYTOV);
      expect(rows[t6].percent!).toBeLessThan(rows[mamytov].percent!);
      expect(t6).toBeLessThan(mamytov);

      // 1.8: chip color by threshold, late lessons don't lower the percent.
      for (const r of rows.filter((x) => x.percent !== null)) {
        const chip = page.getByRole("row").filter({ hasText: r.name }).getByText(`${r.percent}%`, { exact: true });
        await expect(chip.locator("xpath=..")).toHaveCSS("background-color", percentRgb(r.percent!));
      }
      const lateOne = rows.find((r) => r.late > 0)!;
      expect(lateOne.percent).toBe(percentOf(lateOne.conducted, lateOne.expected));
    });

    test("AC-1.11, AC-1.12, AC-1.13, AC-2.20: плитки и «Эң төмөн көрсөткүч» на главной равны «Мониторингу»", async ({ page }) => {
      await page.goto("/monitoring");
      await setPeriod(page, SEMESTER_START, TODAY);
      const rows = await readMonitoringTable(page);
      const sum = (k: "expected" | "conducted" | "missed" | "late" | "attention") => rows.reduce((s, r) => s + r[k], 0);

      // Through the menu, not a reload: the same app, the same period.
      await goViaMenu(page, "dashboard");
      await setPeriod(page, SEMESTER_START, TODAY, "/dashboard/teacher-monitoring-summary");
      await expect.poll(() => tileValue(page, "monitoring.col_expected")).toBe(String(sum("expected")));
      await expect.poll(() => tileValue(page, "monitoring.col_conducted")).toBe(String(sum("conducted")));
      await expect.poll(() => tileValue(page, "monitoring.col_missed")).toBe(String(sum("missed")));
      await expect.poll(() => tileValue(page, "monitoring.col_late")).toBe(String(sum("late")));
      await expect.poll(() => tileValue(page, "monitoring.col_attention")).toBe(String(sum("attention")));
      await expect.poll(() => tileValue(page, "monitoring.col_percent")).toBe(`${percentOf(sum("conducted"), sum("expected"))}%`);

      // 1.13: up to 5 teachers below 100 %, in the monitoring order, each with "NN%" and misses.
      const title = page.getByText(tr("dashboard.lowest_percent_title"), { exact: true });
      await expect(title).toBeVisible();
      const list = title.locator("xpath=..");
      const expectedTop = rows.filter((r) => r.percent !== null && r.percent < 100).slice(0, 5);
      const lines = (await list.innerText()).split("\n").map((s) => s.trim()).filter(Boolean).slice(1);
      expect(lines.length).toBe(expectedTop.length * 3);
      expectedTop.forEach((r, i) => {
        expect(lines.slice(i * 3, i * 3 + 3)).toEqual([r.name, `${r.percent}%`, `${tr("monitoring.col_missed")}: ${r.missed}`]);
      });

      // No lessons in the period → the old "no missed lessons" hint instead of the list.
      await setPeriod(page, "2026-08-01", "2026-08-31", "/dashboard/teacher-monitoring-summary");
      await expect(page.getByText(tr("dashboard.no_missed_hint"), { exact: true })).toBeVisible();
      await expect(title).toHaveCount(0);
    });

    test("AC-2.16, AC-2.17, AC-2.18, AC-2.19, AC-2.21: «Көңүл буруу керек» и чипы в журнале по дням", async ({ page, request }) => {
      const api = await staffApi(request);
      const log = await api.log(await api.teacherId(T6));
      const opened = log.filter((r) => r.status === "CONDUCTED");
      const flagged = opened.filter((r) => r.no_student_marks || r.early_finish);
      const both = opened.find((r) => r.no_student_marks && r.early_finish)!;
      const earlyOnly = opened.find((r) => r.early_finish && !r.no_student_marks)!;
      const noMarksOnly = opened.find((r) => r.no_student_marks && !r.early_finish && r.group_name === T6_GROUP)!;
      const hafizWithScores = opened.find((r) => r.group_name === T6_HAFIZ_GROUP && !r.no_student_marks)!;
      const hafizWithoutScores = opened.find((r) => r.group_name === T6_HAFIZ_GROUP && r.no_student_marks)!;
      for (const r of [both, earlyOnly, noMarksOnly, hafizWithScores, hafizWithoutScores]) expect(r).toBeTruthy();

      await page.goto("/monitoring");
      await setPeriod(page, SEMESTER_START, TODAY);
      await expect(page.getByRole("columnheader", { name: tr("monitoring.col_attention"), exact: true })).toBeVisible();
      const row = await teacherRow(page, T6);
      // 2.19: the lesson with both flags counts once.
      expect(row.attention).toBe(flagged.length);
      expect(row.attention).toBe(4);
      expect(row.conducted).toBe(opened.length); // still conducted (2.17)
      const chip = page.getByRole("row").filter({ hasText: T6 }).getByRole("cell").nth(5).getByText(String(row.attention));
      await expect(chip.locator("xpath=..")).toHaveCSS("background-color", "rgb(250, 178, 25)");

      const dialog = await openLog(page, T6);
      const noMarks = tr("monitoring.flag_no_marks");
      const early = tr("monitoring.flag_early_finish");
      await expect(logRow(dialog, both.date, T6_GROUP).getByText(noMarks, { exact: true })).toBeVisible();
      await expect(logRow(dialog, both.date, T6_GROUP).getByText(early, { exact: true })).toBeVisible();
      await expect(logRow(dialog, earlyOnly.date, T6_GROUP).getByText(early, { exact: true })).toBeVisible();
      await expect(logRow(dialog, earlyOnly.date, T6_GROUP).getByText(noMarks, { exact: true })).toHaveCount(0);
      await expect(logRow(dialog, noMarksOnly.date, T6_GROUP).getByText(noMarks, { exact: true })).toBeVisible();
      await expect(logRow(dialog, noMarksOnly.date, T6_GROUP).getByText(early, { exact: true })).toHaveCount(0);
      // 2.21: a hafiz lesson with the group's hifz scores that day is not "pupils not marked".
      await expect(logRow(dialog, hafizWithScores.date, T6_HAFIZ_GROUP).getByText(tr("monitoring.status_conducted"), { exact: true })).toBeVisible();
      await expect(logRow(dialog, hafizWithScores.date, T6_HAFIZ_GROUP).getByText(noMarks, { exact: true })).toHaveCount(0);
      await expect(logRow(dialog, hafizWithoutScores.date, T6_HAFIZ_GROUP).getByText(noMarks, { exact: true })).toBeVisible();
    });

    test("AC-2.8, AC-2.9, AC-2.10, AC-2.11, AC-2.12, AC-2.14: отметка причины меняет цифры без перезагрузки", async ({ page, request }) => {
      const api = await staffApi(request);
      const target = missed(await api.log(await api.teacherId(T6)), T6_GROUP)[0];
      const comment = "e2e: сабак кагаз журналда өттү";
      try {
        // The dashboard's figures before, to see them change after the mark (2.14).
        await page.goto("/dashboard");
        const summary = await setPeriod(page, SEMESTER_START, TODAY, "/dashboard/teacher-monitoring-summary");
        await expect.poll(() => tileValue(page, "monitoring.col_missed")).toBe(String(summary.missed_lessons));
        await goViaMenu(page, "monitoring");
        await setPeriod(page, SEMESTER_START, TODAY);
        const before = await teacherRow(page, T6);

        let dialog = await openLog(page, T6);
        let row = logRow(dialog, target.date, T6_GROUP);
        await expect(row.getByText(tr("monitoring.status_missed"), { exact: true })).toBeVisible();
        await row.getByRole("button", { name: tr("monitoring.mark_reason") }).click();

        // 2.9: three reasons, a comment, Save disabled until a reason is picked.
        let mark = markDialog(page);
        await expect(mark.getByRole("radio")).toHaveCount(3);
        for (const key of ["monitoring.reason_forgot", "monitoring.reason_excused", "monitoring.reason_cancelled"]) {
          await expect(mark.getByRole("radio", { name: tr(key), exact: true })).toBeVisible();
        }
        await expect(mark.getByRole("button", { name: tr("common.cancel") })).toBeVisible();
        const save = mark.getByRole("button", { name: tr("common.save") });
        await expect(save).toBeDisabled();
        await mark.getByRole("radio", { name: tr("monitoring.reason_forgot"), exact: true }).check();
        await mark.getByLabel(tr("monitoring.mark_comment")).fill(comment);
        await expect(save).toBeEnabled();
        await save.click();
        await expect(mark).toHaveCount(0);

        // 2.10: conducted by the mark; reason, comment and who marked under the status.
        dialog = page.getByRole("dialog").filter({ hasText: tr("monitoring.log_title").replace("{{name}}", T6) });
        row = logRow(dialog, target.date, T6_GROUP);
        await expect(row.getByText(tr("monitoring.status_conducted_by_mark"), { exact: true })).toBeVisible();
        await expect(row.getByText(tr("monitoring.reason_forgot"), { exact: true })).toBeVisible();
        await expect(row.getByText(comment, { exact: true })).toBeVisible();
        await expect(row.getByText(new RegExp(`^${tr("monitoring.mark_by").split("{{name}}")[0]}rector, `))).toBeVisible();
        await dialog.getByRole("button", { name: tr("common.close") }).click();
        await expect
          .poll(() => teacherRow(page, T6))
          .toMatchObject({
            expected: before.expected,
            conducted: before.conducted + 1,
            missed: before.missed - 1,
            percent: percentOf(before.conducted + 1, before.expected),
          });
        await goViaMenu(page, "dashboard");
        await setPeriod(page, SEMESTER_START, TODAY, "/dashboard/teacher-monitoring-summary");
        await expect.poll(() => tileValue(page, "monitoring.col_missed")).toBe(String(summary.missed_lessons - 1));
        await expect.poll(() => tileValue(page, "monitoring.col_conducted")).toBe(String(summary.conducted_lessons + 1));
        await goViaMenu(page, "monitoring");
        await setPeriod(page, SEMESTER_START, TODAY);

        // 2.11: "excused" instead — not expected any more, the row stays with a grey chip.
        dialog = await openLog(page, T6);
        row = logRow(dialog, target.date, T6_GROUP);
        await row.getByRole("button", { name: tr("monitoring.mark_reason") }).click();
        mark = markDialog(page);
        await expect(mark.getByRole("radio", { name: tr("monitoring.reason_forgot"), exact: true })).toBeChecked();
        await mark.getByRole("radio", { name: tr("monitoring.reason_excused"), exact: true }).check();
        await mark.getByRole("button", { name: tr("common.save") }).click();
        await expect(mark).toHaveCount(0);
        row = logRow(dialog, target.date, T6_GROUP);
        const excusedChip = row.getByText(tr("monitoring.reason_excused"), { exact: true }).first();
        await expect(excusedChip).toBeVisible();
        await expect(row.getByText(tr("monitoring.status_missed"), { exact: true })).toHaveCount(0);
        await expect(excusedChip.locator("xpath=..")).not.toHaveCSS("background-color", "rgb(208, 59, 59)");
        await dialog.getByRole("button", { name: tr("common.close") }).click();
        await expect
          .poll(() => teacherRow(page, T6))
          .toMatchObject({
            expected: before.expected - 1,
            conducted: before.conducted,
            missed: before.missed - 1,
            percent: percentOf(before.conducted, before.expected - 1),
          });

        // 2.12: remove with a question — missed again, figures back.
        dialog = await openLog(page, T6);
        await logRow(dialog, target.date, T6_GROUP).getByRole("button", { name: tr("monitoring.mark_reason") }).click();
        mark = markDialog(page);
        await mark.getByRole("button", { name: tr("monitoring.remove_mark") }).click();
        const ask = question(page);
        await expect(ask.getByText(tr("monitoring.remove_mark_confirm"), { exact: true })).toBeVisible();
        await ask.getByRole("button", { name: tr("monitoring.remove_mark") }).click();
        await expect(mark).toHaveCount(0);
        await expect(logRow(dialog, target.date, T6_GROUP).getByText(tr("monitoring.status_missed"), { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: tr("common.close") }).click();
        await expect.poll(() => teacherRow(page, T6)).toEqual(before);
      } finally {
        const left = (await api.log(await api.teacherId(T6))).find((r) => r.date === target.date && r.mark);
        if (left) await request.delete(`${API_URL}/monitoring/lesson-marks/${left.mark!.id}`, { headers: api.headers });
      }
    });

    test("AC-2.13, AC-2.28: у открытого, идущего и внесеместрового урока отметки нет — сервер отвечает 409", async ({ page, request }) => {
      const api = await staffApi(request);
      const log = await api.log(await api.teacherId(T6));
      const opened = log.find((r) => r.status === "CONDUCTED" && r.group_name === T6_GROUP)!;
      const entry = opened.schedule_entry_id;

      await page.goto("/monitoring");
      await setPeriod(page, SEMESTER_START, TODAY);
      const dialog = await openLog(page, T6);
      const row = logRow(dialog, opened.date, T6_GROUP);
      await expect(row.getByText(tr("monitoring.status_conducted"), { exact: true })).toBeVisible();
      await expect(row.getByRole("button", { name: tr("monitoring.mark_reason") })).toHaveCount(0);

      const put = (date: string) =>
        request.put(`${API_URL}/monitoring/lesson-marks`, {
          headers: api.headers,
          data: { schedule_entry_id: entry, date, kind: "FORGOT_TO_OPEN" },
        });
      const shift = (iso: string, days: number) => {
        const d = new Date(`${iso}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
      };
      // Same weekday as the entry: an opened lesson, one before the semester, one in the future.
      const firstOfSemester = missed(log, T6_GROUP)[0].date;
      const nextWeek = shift(log.filter((r) => r.group_name === T6_GROUP)[0].date, 7);
      const future = nextWeek > TODAY ? nextWeek : shift(nextWeek, 7);
      expect((await put(opened.date)).status()).toBe(409);
      expect((await put(shift(firstOfSemester, -7))).status()).toBe(409);
      expect((await put(future)).status()).toBe(409);
      // Nothing was created: the opened lesson is still a plain «Өткөрүлгөн» without a mark.
      expect((await api.log(await api.teacherId(T6))).find((r) => r.date === opened.date && r.group_name === T6_GROUP)).toMatchObject({
        status: "CONDUCTED",
        mark: null,
      });
    });

    test("AC-2.1, AC-2.2, AC-2.3, AC-2.4, AC-2.5, AC-2.7: нерабочий день — добавить, изменить, удалить", async ({ page, request }) => {
      const api = await staffApi(request);
      const t6Id = await api.teacherId(T6);
      const log = await api.log(t6Id);
      const holiday = missed(log, T6_HAFIZ_GROUP)[0].date; // a missed «Хафиз 1» lesson
      const openedDay = log.find((r) => r.status === "CONDUCTED" && r.group_name === T6_GROUP)!.date;
      const name = `Нооруз (e2e ${Date.now() % 100000})`;
      const mamytovMissedThatDay = (await api.log(await api.teacherId(MAMYTOV))).filter(
        (r) => r.date === holiday && r.status === "MISSED",
      ).length;
      try {
        await page.goto("/monitoring");
        await setPeriod(page, SEMESTER_START, TODAY);
        const before = await teacherRow(page, T6);
        const mamytovBefore = await teacherRow(page, MAMYTOV);

        // 2.1: in the menu next to «Семестрлер», list columns and «Кошуу».
        await goViaMenu(page, "non_working_days");
        // The empty list's hint has its own «Кошуу»; the page button comes first.
        await page.getByRole("button", { name: tr("common.add") }).first().click();
        const form = page.getByRole("dialog");
        const save = form.getByRole("button", { name: tr("common.save") });

        // 2.4: empty name and end before start are refused under the fields.
        await form.getByLabel(tr("non_working_days.start")).fill("2026-03-21");
        await form.getByLabel(tr("non_working_days.end")).fill("2026-03-20");
        await save.click();
        await expect(form.getByText(tr("non_working_days.error_name_required"), { exact: true })).toBeVisible();
        await expect(form.getByText(tr("non_working_days.error_end_before_start"), { exact: true })).toBeVisible();

        // 2.2: added on the date of a missed lesson — the lesson leaves the plan and the log.
        await form.getByLabel(tr("non_working_days.name")).fill(name);
        await form.getByLabel(tr("non_working_days.start")).fill(holiday);
        await form.getByLabel(tr("non_working_days.end")).fill(holiday);
        await save.click();
        await expect(form).toHaveCount(0);
        const listed = page.getByRole("row").filter({ hasText: name });
        await expect(listed).toContainText(holiday);
        for (const key of ["non_working_days.name", "non_working_days.start", "non_working_days.end"]) {
          await expect(page.getByRole("columnheader", { name: tr(key), exact: true })).toBeVisible();
        }
        await expect(listed.getByRole("button", { name: tr("common.edit") })).toBeVisible();

        await goViaMenu(page, "monitoring");
        await setPeriod(page, SEMESTER_START, TODAY);
        expect(await teacherRow(page, T6)).toMatchObject({
          expected: before.expected - 1,
          conducted: before.conducted,
          missed: before.missed - 1,
        });
        // 2.7: the whole madrasa — a teacher of the other department loses his missed lessons that day too.
        expect((await teacherRow(page, MAMYTOV)).expected).toBe(mamytovBefore.expected - mamytovMissedThatDay);
        let dialog = await openLog(page, T6);
        await expect(dialog.getByRole("row").filter({ hasText: holiday })).toHaveCount(0);
        await dialog.getByRole("button", { name: tr("common.close") }).click();

        // 2.5 change + 2.3: moved onto a day with an opened lesson — that lesson still counts.
        await goViaMenu(page, "non_working_days");
        await listed.getByRole("button", { name: tr("common.edit") }).click();
        await form.getByLabel(tr("non_working_days.start")).fill(openedDay);
        await form.getByLabel(tr("non_working_days.end")).fill(openedDay);
        await form.getByRole("button", { name: tr("common.save") }).click();
        await expect(form).toHaveCount(0);
        await expect(listed).toContainText(openedDay);
        await goViaMenu(page, "monitoring");
        await setPeriod(page, SEMESTER_START, TODAY);
        expect(await teacherRow(page, T6)).toEqual(before);
        dialog = await openLog(page, T6);
        await expect(logRow(dialog, openedDay, T6_GROUP).getByText(tr("monitoring.status_conducted"), { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: tr("common.close") }).click();

        // 2.5 delete: a labelled button and the question «Бул иш эмес күндү өчүрөсүзбү?».
        await goViaMenu(page, "non_working_days");
        await listed.getByRole("button", { name: tr("common.remove") }).click();
        const ask = page.getByRole("dialog").filter({ hasText: tr("non_working_days.delete_confirm") });
        await expect(ask).toBeVisible();
        await ask.getByRole("button", { name: tr("common.remove") }).click();
        await expect(listed).toHaveCount(0);
        await goViaMenu(page, "monitoring");
        await setPeriod(page, SEMESTER_START, TODAY);
        expect(await teacherRow(page, T6)).toEqual(before);
      } finally {
        for (const d of (await api.nonWorkingDays()).filter((x) => x.name === name)) {
          await request.delete(`${API_URL}/non-working-days/${d.id}`, { headers: api.headers });
        }
      }
    });

    test("AC-2.22, AC-2.23: порог опоздания 10 мин помечает урок с опозданием 12 мин «Кечикти»", async ({ page, request }) => {
      const api = await staffApi(request);
      const lateBy12 = (await api.log(await api.teacherId(T6))).find((r) => r.early_finish && !r.no_student_marks)!;
      try {
        await page.goto("/monitoring");
        await setPeriod(page, SEMESTER_START, TODAY);
        const before = await teacherRow(page, T6);
        expect(before.late).toBe(0); // 12 min is not late with the default 15

        await goViaMenu(page, "timeslots");
        const field = page.getByLabel(tr("timeslots.late_threshold"));
        await expect(field).toHaveValue("15");
        const save = page.getByRole("button", { name: tr("common.save") });
        for (const wrong of ["61", "-1"]) {
          await field.fill(wrong);
          await expect(page.getByText(tr("timeslots.late_threshold_error"), { exact: true })).toBeVisible();
          await expect(save).toBeDisabled();
        }
        await field.fill("10");
        await expect(page.getByText(tr("timeslots.late_threshold_error"), { exact: true })).toHaveCount(0);
        await saveThreshold(page, save, 10);

        await goViaMenu(page, "monitoring");
        await setPeriod(page, SEMESTER_START, TODAY);
        expect(await teacherRow(page, T6)).toMatchObject({ ...before, late: 1 });
        const dialog = await openLog(page, T6);
        await expect(logRow(dialog, lateBy12.date, T6_GROUP).getByText(tr("monitoring.status_late"), { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: tr("common.close") }).click();

        // Back to 15 through the same field.
        await goViaMenu(page, "timeslots");
        await expect(field).toHaveValue("10");
        await field.fill("15");
        await saveThreshold(page, save, 15);
        await goViaMenu(page, "monitoring");
        await setPeriod(page, SEMESTER_START, TODAY);
        expect((await teacherRow(page, T6)).late).toBe(0);
      } finally {
        await request.patch(`${API_URL}/settings`, { headers: api.headers, data: { late_threshold_minutes: 15 } });
      }
    });
  });

  test.describe("телефон", () => {
    test.skip(({ isMobile }) => !isMobile, "карточки и плитки на узком экране — проверка телефона");
    test.use({ viewport: { width: 375, height: 812 } });

    test("AC-1.10, AC-2.16: карточка учителя — чип процента и 5 плиток без горизонтальной прокрутки", async ({ page }) => {
      await page.goto("/monitoring");
      await setPeriod(page, SEMESTER_START, TODAY);
      const card = page
        .locator("div")
        .filter({ hasText: T6 })
        .filter({ has: page.getByText(tr("monitoring.col_attention"), { exact: true }) })
        .last();
      await expect(card).toBeVisible();
      await expect(card.getByText(/^\d+%$/)).toBeVisible();
      for (const key of ["col_expected", "col_conducted", "col_missed", "col_late", "col_attention"]) {
        const label = card.getByText(tr(`monitoring.${key}`), { exact: true });
        await expect(label).toBeVisible();
        const box = (await label.boundingBox())!;
        expect(box.x + box.width, key).toBeLessThanOrEqual(375);
      }
      await expectNoPageScrollX(page);
    });

    test("AC-2.8, AC-2.9: на телефоне кнопка «Себебин белгилөө» во всю ширину, окно отметки на весь экран", async ({ page, request }) => {
      const api = await staffApi(request);
      const target = missed(await api.log(await api.teacherId(T6)), T6_GROUP)[0];
      await page.goto("/monitoring");
      await setPeriod(page, SEMESTER_START, TODAY);
      await page.getByText(T6, { exact: true }).click();
      const dialog = page.getByRole("dialog").filter({ hasText: tr("monitoring.log_title").replace("{{name}}", T6) });
      const card = dialog
        .locator("div")
        .filter({ hasText: target.date })
        .filter({ has: page.getByRole("button", { name: tr("monitoring.mark_reason") }) })
        .last();
      const button = card.getByRole("button", { name: tr("monitoring.mark_reason") });
      const [b, c] = [(await button.boundingBox())!, (await card.boundingBox())!];
      expect(b.width).toBeGreaterThan(c.width - 40); // full card width minus padding
      expect(b.height).toBeGreaterThanOrEqual(40);
      await button.click();
      const mark = markDialog(page);
      await expect(mark.getByRole("button", { name: tr("common.save") })).toBeDisabled();
      const m = (await mark.boundingBox())!;
      expect(m.width).toBeGreaterThanOrEqual(375 - 1);
      await mark.getByRole("button", { name: tr("common.cancel") }).click();
      await expect(mark).toHaveCount(0);
      await expectNoPageScrollX(page);
    });

    test("AC-2.6: нерабочие дни на телефоне — карточки с подписанными кнопками не ниже 40 px", async ({ page, request }) => {
      const api = await staffApi(request);
      const name = `Курман айт (e2e ${Date.now() % 100000})`;
      const res = await request.post(`${API_URL}/non-working-days`, {
        headers: api.headers,
        data: { name, start_date: "2026-05-27", end_date: "2026-05-29" },
      });
      expect(res.status()).toBe(201);
      const id = (await res.json()).id as number;
      try {
        await page.getByRole("button", { name: tr("nav.menu") }).click();
        await goViaMenu(page, "non_working_days");
        await expect(page.getByRole("table")).toHaveCount(0);
        const card = page
          .locator("div")
          .filter({ hasText: name })
          .filter({ has: page.getByRole("button", { name: tr("common.remove") }) })
          .last();
        await expect(card).toContainText("2026-05-27");
        for (const key of ["common.edit", "common.remove"]) {
          const box = (await card.getByRole("button", { name: tr(key) }).boundingBox())!;
          expect(box.height, key).toBeGreaterThanOrEqual(40);
        }
        await expectNoPageScrollX(page);
      } finally {
        await request.delete(`${API_URL}/non-working-days/${id}`, { headers: api.headers });
      }
    });
  });
});
