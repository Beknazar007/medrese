// ux-fixes-2 — хафиз-учитель «Абдыкадыров Ислам»: посещаемость на вкладке «Сабак» (B7), планы, экзамены и
// задания без вопроса и с вопросом (B8: C11–C19), даты в планах и экзаменах (B10), ФИО (B11).
// Спека: specs/ux-fixes-2.md. Данные — e2e/fixtures/seed.py: урок «Хафиз 1» сегодня (пара на весь день),
// у «Токтогулов Умар» план 2026-10-27 — 2026-11-16 и экзамен 2026-11-05, «Сыдыков Билал» освобождён сегодня.
// Всё, что тест создаёт, он сам же удаляет; урок не завершается.
import type { Locator, Page } from "@playwright/test";
import { API_URL, authHeader, expect, loginAs, test, tr, type Lang } from "../../fixtures/app";
import { USERS } from "../../fixtures/users";
import {
  DATED_EXAM,
  DATED_PLAN,
  HAFIZ_DATED,
  HAFIZ_EXCUSED,
  HAFIZ_STUDENT,
  LANGS,
  LETTERS,
  STATUSES,
  bishkekToday,
  expectNoPageScrollX,
  measureButtons,
  question,
  statusButton,
  statusLabel,
  studentBlock,
  track,
  uniq,
} from "./stand";

const ROLE = "hafiz" as const;
const SECOND_STUDENT = "Токтогулов Умар";

async function openLesson(page: Page, lang: Lang = "ky") {
  await loginAs(page, ROLE, lang);
  await page.goto("/hifz-journal");
  await expect(page.getByRole("button", { name: tr("journal.mark_all_present", lang) })).toBeVisible();
}

async function openPlans(page: Page, isMobile: boolean, student: string, lang: Lang = "ky") {
  await studentBlock(page, isMobile, student, lang).getByRole("button", { name: tr("hifz.targets_button", lang) }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: tr("hifz.targets_title", lang).replace("{{name}}", student) });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openExams(page: Page, isMobile: boolean, student: string, lang: Lang = "ky") {
  await studentBlock(page, isMobile, student, lang).getByRole("button", { name: tr("hifz.exams_button", lang) }).click();
  return examsDialog(page, student, lang);
}

async function examsDialog(page: Page, student: string, lang: Lang = "ky") {
  const dialog = page.getByRole("dialog").filter({ hasText: tr("hifz.exams_title", lang).replace("{{name}}", student) });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** One entry in the plans/exams list: the deepest box with the text and its own «Өзгөртүү». */
function entry(dialog: Locator, text: string): Locator {
  return dialog
    .locator("div")
    .filter({ hasText: text })
    .filter({ has: dialog.page().getByRole("button", { name: tr("common.edit"), exact: true }) })
    .last();
}

/** Deletes an entry for real, through the question (tests clean up after themselves). */
async function removeEntry(page: Page, item: Locator) {
  await item.getByRole("button", { name: tr("common.remove"), exact: true }).click();
  await question(page).getByRole("button", { name: tr("common.remove"), exact: true }).click();
  await expect(item).toHaveCount(0);
}

/** A tap on a phone, a click on a computer. A mouse click would leave the pointer resting where the
 *  message pops up on a phone, and MUI pauses the message while a pointer is over it. */
async function press(button: Locator, isMobile: boolean) {
  if (isMobile) await button.tap();
  else await button.click();
}

/** Starts timing the "Сакталды" message in the page itself, so the measured time does not depend
 *  on how fast the test notices it. Call before the click that saves. */
async function watchSavedMessage(page: Page) {
  await page.evaluate((text) => {
    const w = window as unknown as { __saved: { shown?: number; hidden?: number } };
    w.__saved = {};
    const isShown = () => [...document.querySelectorAll('[role="alert"]')].some((el) => el.textContent?.trim() === text);
    const observer = new MutationObserver(() => {
      const shown = isShown();
      if (shown && w.__saved.shown === undefined) w.__saved.shown = performance.now();
      if (!shown && w.__saved.shown !== undefined && w.__saved.hidden === undefined) {
        w.__saved.hidden = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }, tr("hifz.saved"));
}

/** "Сакталды" at the bottom of the screen stays at least 3 s (criterion 20). */
async function expectSavedMessage(page: Page) {
  await expect(page.getByText(tr("hifz.saved"), { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __saved: { hidden?: number } }).__saved.hidden), { timeout: 8_000 })
    .toBeDefined();
  const { shown, hidden } = await page.evaluate(() => (window as unknown as { __saved: { shown: number; hidden: number } }).__saved);
  expect(hidden - shown, "how long «Сакталды» was on screen, ms").toBeGreaterThanOrEqual(3_000);
}

test.describe(`ux-fixes-2 — ${ROLE}`, () => {
  for (const lang of LANGS) {
    test.describe(`язык ${lang}`, () => {
      test.use({ lang });

      test(`AC-1, AC-5, AC-6: буквы «${LETTERS[lang].join(" ")}», полные слова и легенда на вкладке «Сабак» (${lang})`, async ({ page, isMobile }) => {
        await openLesson(page, lang);
        for (const name of [HAFIZ_STUDENT, SECOND_STUDENT]) {
          const group = studentBlock(page, isMobile, name, lang).getByRole("group");
          await expect(group.getByRole("button")).toHaveText(LETTERS[lang]);
          const labels = await group.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
          expect(labels).toEqual(STATUSES.map((s) => statusLabel(s, lang)));
        }
        const legend = page.getByTestId("attendance-legend");
        for (const [i, status] of STATUSES.entries()) {
          await expect(legend).toContainText(`${LETTERS[lang][i]} — ${statusLabel(status, lang)}: `);
        }
      });
    });
  }

  test.describe("телефон 390×844", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test.skip(({ isMobile }) => !isMobile, "размер кнопок на телефоне");

    test("AC-7: на вкладке «Сабак» кнопки не меньше 44×44, буква ≥ 16 px, без горизонтальной прокрутки", async ({ page }) => {
      await openLesson(page);
      for (const name of [HAFIZ_STUDENT, SECOND_STUDENT, HAFIZ_EXCUSED.name]) {
        const card = studentBlock(page, true, name);
        await card.scrollIntoViewIfNeeded();
        for (const b of await measureButtons(card)) {
          expect(b.width, `${name} ${b.status} width`).toBeGreaterThanOrEqual(44);
          expect(b.height, `${name} ${b.status} height`).toBeGreaterThanOrEqual(44);
          expect(b.fontSize, `${name} ${b.status} font`).toBeGreaterThanOrEqual(16);
          expect(b.right, `${name} ${b.status} right edge`).toBeLessThanOrEqual(390);
        }
      }
      await expectNoPageScrollX(page);
    });
  });

  test.describe("компьютер 1280×800", () => {
    test.use({ viewport: { width: 1280, height: 800 } });
    test.skip(({ isMobile }) => isMobile, "таблица — широкий экран");

    test("AC-8: кнопки не меньше 44×44 и стоят сеткой 2×2 — ячейка посещаемости не шире 110 px", async ({ page }) => {
      await openLesson(page);
      const row = studentBlock(page, false, HAFIZ_STUDENT);
      const sizes = await measureButtons(row);
      for (const b of sizes) {
        expect(b.width, `${b.status} width`).toBeGreaterThanOrEqual(44);
        expect(b.height, `${b.status} height`).toBeGreaterThanOrEqual(44);
      }
      const boxes = await Promise.all(STATUSES.map(async (s) => (await statusButton(row, s).boundingBox())!));
      // К Ж on the first line, О С under them.
      expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(2);
      expect(boxes[2].y).toBeGreaterThan(boxes[0].y + 40);
      // Neighbours don't overlap.
      expect(boxes[0].x + boxes[0].width).toBeLessThanOrEqual(boxes[1].x);
      expect(boxes[2].x + boxes[2].width).toBeLessThanOrEqual(boxes[3].x);
      const groupWidth = await row.getByRole("group").evaluate((g) => g.getBoundingClientRect().width);
      expect(groupWidth).toBeLessThanOrEqual(110);
    });
  });

  test("AC-10: у освобождённого кнопки заблокированы, выбрана «С», видна причина", async ({ page, isMobile }) => {
    await openLesson(page);
    const block = studentBlock(page, isMobile, HAFIZ_EXCUSED.name);
    for (const status of STATUSES) await expect(statusButton(block, status)).toBeDisabled();
    await expect(statusButton(block, "excused")).toHaveAttribute("aria-pressed", "true");
    await expect(block.getByText(`${tr("journal.excused_by_deanery")}: ${HAFIZ_EXCUSED.reason}`)).toBeVisible();
  });

  test("AC-11, AC-24: нажатие ставит и снимает отметку, «Баарын келди» работает, окон вопроса нет", async ({ page, isMobile }) => {
    await openLesson(page);
    const saves = track(page, "PUT", /\/hifz\/sessions\/\d+\/attendance$/);
    const block = studentBlock(page, isMobile, HAFIZ_STUDENT);
    const late = statusButton(block, "late");
    if ((await late.getAttribute("aria-pressed")) === "true") await late.click();
    await expect(late).toHaveAttribute("aria-pressed", "false");
    await late.click();
    await expect(late).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => saves.length).toBeGreaterThan(0);
    await late.click();
    await expect(late).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: tr("journal.mark_all_present") }).click();
    await expect(statusButton(block, "present")).toHaveAttribute("aria-pressed", "true");
    await expect(statusButton(studentBlock(page, isMobile, HAFIZ_EXCUSED.name), "excused")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(tr("hifz.autosave_hint"), { exact: true })).toBeVisible();
    await expect(question(page)).toHaveCount(0);
  });

  test("AC-20, AC-23 (C12, C13): план добавляется и меняется без вопроса, «Сакталды»; удаление — с вопросом", async ({ page, isMobile }) => {
    await openLesson(page);
    const dialog = await openPlans(page, isMobile, HAFIZ_STUDENT);
    const note = `план ${uniq()}`;
    await dialog.getByLabel(tr("hifz.target_juz_from")).fill("3");
    await dialog.getByLabel(tr("hifz.target_note")).fill(note);
    await watchSavedMessage(page);
    await press(dialog.getByRole("button", { name: tr("hifz.target_add"), exact: true }), isMobile);
    await expect(question(page)).toHaveCount(0);
    const item = entry(dialog, note);
    await expect(item).toBeVisible();
    await expect(dialog.getByLabel(tr("hifz.target_note"))).toHaveValue("");
    await expect(dialog.getByLabel(tr("hifz.target_juz_from"))).toHaveValue("");
    await expectSavedMessage(page);

    // Change it: same, no question.
    await item.getByRole("button", { name: tr("common.edit"), exact: true }).click();
    await expect(dialog.getByLabel(tr("hifz.target_note"))).toHaveValue(note);
    const changed = `${note} өзгөрдү`;
    await dialog.getByLabel(tr("hifz.target_note")).fill(changed);
    await dialog.getByRole("button", { name: tr("hifz.target_save"), exact: true }).click();
    await expect(question(page)).toHaveCount(0);
    const changedItem = entry(dialog, changed);
    await expect(changedItem).toBeVisible();
    await expect(page.getByText(tr("hifz.saved"), { exact: true })).toBeVisible();

    // C13: deleting asks; «Жокко чыгаруу» sends nothing.
    const deletes = track(page, "DELETE", /\/hifz\/targets\/\d+$/);
    await changedItem.getByRole("button", { name: tr("common.remove"), exact: true }).click();
    await expect(question(page)).toContainText(tr("common.confirm_delete"));
    await question(page).getByRole("button", { name: tr("common.cancel"), exact: true }).click();
    await page.waitForTimeout(300);
    expect(deletes).toEqual([]);
    await expect(changedItem).toBeVisible();
    await removeEntry(page, changedItem);
  });

  test("AC-22 (C12): двойное нажатие «План кошуу» создаёт один план", async ({ page, isMobile }) => {
    await openLesson(page);
    const dialog = await openPlans(page, isMobile, HAFIZ_STUDENT);
    const posts = track(page, "POST", /\/hifz\/targets$/);
    const note = `кош басуу ${uniq()}`;
    await dialog.getByLabel(tr("hifz.target_juz_from")).fill("4");
    await dialog.getByLabel(tr("hifz.target_note")).fill(note);
    await dialog.getByRole("button", { name: tr("hifz.target_add"), exact: true }).dblclick();
    await expect(entry(dialog, note)).toHaveCount(1);
    await page.waitForTimeout(1_000);
    expect(posts).toHaveLength(1);
    await expect(entry(dialog, note)).toHaveCount(1);
    await removeEntry(page, entry(dialog, note));
  });

  test("AC-20, AC-23 (C14, C15): экзамен добавляется и меняется без вопроса, «Сакталды»; удаление — с вопросом", async ({ page, isMobile }) => {
    await openLesson(page);
    const dialog = await openExams(page, isMobile, HAFIZ_STUDENT);
    const posts = track(page, "POST", /\/hifz\/exams$/);
    const title = `сынак ${uniq()}`;
    await dialog.getByLabel(tr("hifz.exam_title")).fill(title);
    await dialog.getByLabel(tr("hifz.exam_score")).fill("91");
    await watchSavedMessage(page);
    await press(dialog.getByRole("button", { name: tr("hifz.exam_add"), exact: true }), isMobile);
    await expect(question(page)).toHaveCount(0);
    const item = entry(dialog, title);
    await expect(item).toHaveCount(1);
    await expect(item).toContainText(/\d\d\.\d\d\.\d{4} — /);
    await expect(dialog.getByLabel(tr("hifz.exam_title"))).toHaveValue("");
    await expectSavedMessage(page);
    expect(posts).toHaveLength(1);

    // Criterion 22: a double click on «Экзамен кошуу» still makes one exam.
    const twice = `кош басуу ${uniq()}`;
    await dialog.getByLabel(tr("hifz.exam_title")).fill(twice);
    await dialog.getByRole("button", { name: tr("hifz.exam_add"), exact: true }).dblclick();
    await expect(entry(dialog, twice)).toHaveCount(1);
    await page.waitForTimeout(1_000);
    expect(posts).toHaveLength(2);
    await expect(entry(dialog, twice)).toHaveCount(1);
    await removeEntry(page, entry(dialog, twice));

    await item.getByRole("button", { name: tr("common.edit"), exact: true }).click();
    const changed = `${title} 2`;
    await dialog.getByLabel(tr("hifz.exam_title")).fill(changed);
    await dialog.getByRole("button", { name: tr("hifz.exam_save"), exact: true }).click();
    await expect(question(page)).toHaveCount(0);
    const changedItem = entry(dialog, changed);
    await expect(changedItem).toBeVisible();
    await expect(page.getByText(tr("hifz.saved"), { exact: true })).toBeVisible();

    const deletes = track(page, "DELETE", /\/hifz\/exams\/\d+$/);
    await changedItem.getByRole("button", { name: tr("common.remove"), exact: true }).click();
    await expect(question(page)).toContainText(tr("common.confirm_delete"));
    await question(page).getByRole("button", { name: tr("common.cancel"), exact: true }).click();
    await page.waitForTimeout(300);
    expect(deletes).toEqual([]);
    await removeEntry(page, changedItem);
  });

  test("AC-21, AC-23 (C16, C17, C18): задание одному — без вопроса, нескольким — вопрос с числом, удаление — с вопросом", async ({ page }) => {
    await loginAs(page, ROLE);
    await page.goto("/hifz-journal");
    await page.getByRole("tab", { name: tr("hifz.tab_assignments"), exact: true }).click();
    const bulk = track(page, "POST", /\/hifz\/targets\/bulk$/);

    // One student: issued at once.
    await page.getByRole("button", { name: tr("hifz.assignment_new"), exact: true }).click();
    let dialog = page.getByRole("dialog").filter({ hasText: tr("hifz.assignment_new") });
    const note = `тапшырма ${uniq()}`;
    await dialog.getByRole("checkbox", { name: HAFIZ_STUDENT }).check();
    await dialog.getByLabel(tr("hifz.target_juz_from")).fill("6");
    await dialog.getByLabel(tr("hifz.target_note")).fill(note);
    await dialog.getByRole("button", { name: tr("hifz.assignment_issue"), exact: true }).click();
    await expect(question(page)).toHaveCount(0);
    await expect(page.getByText(tr("hifz.assignment_issued"), { exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(bulk).toHaveLength(1);
    const card = page
      .locator("div")
      .filter({ hasText: note })
      .filter({ has: page.getByRole("button", { name: tr("hifz.edit"), exact: true }) })
      .last();
    await expect(card).toBeVisible();

    // C16: changing it — no question.
    await card.getByRole("button", { name: tr("hifz.edit"), exact: true }).click();
    dialog = page.getByRole("dialog").filter({ hasText: tr("hifz.assignment_edit") });
    await dialog.getByLabel(tr("hifz.target_juz_to")).fill("7");
    await dialog.getByRole("button", { name: tr("hifz.target_save"), exact: true }).click();
    await expect(question(page)).toHaveCount(0);
    await expect(page.getByText(tr("hifz.saved"), { exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();

    // C17: two students — a question with the count; «Жокко чыгаруу» sends nothing, the form stays.
    await page.getByRole("button", { name: tr("hifz.assignment_new"), exact: true }).click();
    dialog = page.getByRole("dialog").filter({ hasText: tr("hifz.assignment_new") });
    await dialog.getByRole("checkbox", { name: HAFIZ_STUDENT }).check();
    await dialog.getByRole("checkbox", { name: SECOND_STUDENT }).check();
    await dialog.getByLabel(tr("hifz.target_juz_from")).fill("8");
    await dialog.getByRole("button", { name: tr("hifz.assignment_issue"), exact: true }).click();
    await expect(question(page)).toContainText(tr("hifz.assignment_issue_many_confirm").replace("{{count}}", "2"));
    await question(page).getByRole("button", { name: tr("common.cancel"), exact: true }).click();
    await page.waitForTimeout(300);
    expect(bulk).toHaveLength(1);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(tr("hifz.target_juz_from"))).toHaveValue("8");
    await dialog.getByRole("button", { name: tr("common.cancel"), exact: true }).click();

    // C18: deleting asks; cancel keeps it, then it is removed for real.
    const deletes = track(page, "DELETE", /\/hifz\/targets\/\d+$/);
    await card.getByRole("button", { name: tr("common.remove"), exact: true }).click();
    await expect(question(page)).toContainText(tr("hifz.assignment_delete_confirm"));
    await question(page).getByRole("button", { name: tr("common.cancel"), exact: true }).click();
    await page.waitForTimeout(300);
    expect(deletes).toEqual([]);
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: tr("common.remove"), exact: true }).click();
    await question(page).getByRole("button", { name: tr("common.remove"), exact: true }).click();
    await expect(card).toHaveCount(0);
  });

  test("AC-23 (C11, C19): «Сабакты аяктоо» и «Күндү тазалоо» спрашивают, «Жокко чыгаруу» ничего не отправляет", async ({ page }) => {
    await openLesson(page);
    const checkOuts = track(page, "PUT", /\/check-out$/);
    await page.getByRole("button", { name: tr("journal.check_out"), exact: true }).click();
    await expect(question(page)).toContainText(tr("journal.checked_out_confirm"));
    await question(page).getByRole("button", { name: tr("common.cancel"), exact: true }).click();
    await page.waitForTimeout(300);
    expect(checkOuts).toEqual([]);

    // A mark for today, so the day window has something to clear.
    const headers = await authHeader(page);
    const students = (await (await page.request.get(`${API_URL}/students`, { headers })).json()) as { id: number; full_name: string }[];
    const id = students.find((s) => s.full_name === HAFIZ_STUDENT)!.id;
    const put = await page.request.put(`${API_URL}/hifz/record`, {
      headers,
      data: { student_id: id, date: bishkekToday(), kind: "HIFZ", score: 90 },
    });
    expect(put.ok(), await put.text()).toBeTruthy();

    await page.getByRole("tab", { name: tr("hifz.tab_journal"), exact: true }).click();
    const records = track(page, "PUT", /\/hifz\/record$/);
    const row = page.getByRole("row").filter({ hasText: HAFIZ_STUDENT });
    await row.getByRole("cell").nth(3).click();
    const day = page.getByRole("dialog").filter({ hasText: HAFIZ_STUDENT });
    await day.getByRole("button", { name: tr("hifz.clear_day"), exact: true }).click();
    await expect(question(page)).toContainText(tr("hifz.clear_day_confirm"));
    await question(page).getByRole("button", { name: tr("common.cancel"), exact: true }).click();
    await page.waitForTimeout(300);
    expect(records).toEqual([]);
    await expect(day.getByLabel(tr("hifz.score_pct")).first()).toHaveValue("90");
    await day.getByRole("button", { name: tr("hifz.done"), exact: true }).click();
  });

  test("AC-13: буквы хифза «Ж/К» в журнале-сетке не изменились", async ({ page }) => {
    await loginAs(page, ROLE);
    await page.goto("/hifz-journal");
    await page.getByRole("tab", { name: tr("hifz.tab_journal"), exact: true }).click();
    await expect(page.getByText(tr("hifz.kind_hifz_short"), { exact: true }).first()).toBeVisible();
    await expect(page.getByText(tr("hifz.kind_repeat_short"), { exact: true }).first()).toBeVisible();
    expect([tr("hifz.kind_hifz_short"), tr("hifz.kind_repeat_short")]).toEqual(["Ж", "К"]);
  });

  for (const lang of ["ky", "ru"] as const) {
    test.describe(`даты, ${lang}`, () => {
      test.use({ lang });

      test(`AC-32: в «Пландар» срок плана — «${DATED_PLAN.shown}», без ГГГГ-ММ-ДД и «→» (${lang})`, async ({ page, isMobile }) => {
        await openLesson(page, lang);
        const dialog = await openPlans(page, isMobile, HAFIZ_DATED, lang);
        await expect(dialog).toContainText(`${tr("hifz.kind_hifz", lang)} — ${DATED_PLAN.shown}`);
        await expect(dialog).not.toContainText(DATED_PLAN.start);
        await expect(dialog).not.toContainText(/\d{4}-\d\d-\d\d/);
        await expect(dialog).not.toContainText("→");
      });
    });
  }

  for (const lang of LANGS) {
    test.describe(`экзамен, ${lang}`, () => {
      test.use({ lang });

      // Decision 4 (spec, «Открытые вопросы») replaced «5 Nov 2026» in criterion 33: one format on every language.
      test(`AC-33: дата экзамена — «${DATED_EXAM.shown}» на вкладке «Сабак» (${lang})`, async ({ page, isMobile }) => {
        await openLesson(page, lang);
        const dialog = await openExams(page, isMobile, HAFIZ_DATED, lang);
        await expect(dialog).toContainText(`${DATED_EXAM.shown} — ${DATED_EXAM.title}`);
        await expect(dialog).not.toContainText("2026-11-05");
      });
    });
  }

  for (const timezoneId of ["America/Los_Angeles", "Asia/Bishkek"]) {
    test.describe(`часовой пояс ${timezoneId}`, () => {
      test.use({ timezoneId });

      test(`AC-34, AC-35: даты те же при любом часовом поясе — «Тапшырмалар» и экзамен в журнале-сетке (${timezoneId})`, async ({ page }) => {
        await loginAs(page, ROLE);
        await page.goto("/hifz-journal");
        await page.getByRole("tab", { name: tr("hifz.tab_assignments"), exact: true }).click();
        await page.getByRole("combobox", { name: tr("hifz.status") }).click();
        await page.getByRole("option", { name: tr("hifz.status_all"), exact: true }).click();
        const card = page.locator("div").filter({ hasText: "e2e план" }).filter({ has: page.getByRole("button", { name: tr("hifz.edit"), exact: true }) }).last();
        // The same fmtDate as in «Пландар»: «27.10.2026 — 16.11.2026».
        await expect(card).toContainText(DATED_PLAN.shown);

        await page.getByRole("tab", { name: tr("hifz.tab_journal"), exact: true }).click();
        await page.getByRole("row").filter({ hasText: HAFIZ_DATED }).getByRole("cell").nth(2).click();
        const dialog = await examsDialog(page, HAFIZ_DATED);
        await expect(dialog).toContainText(`${DATED_EXAM.shown} — ${DATED_EXAM.title}`);
      });
    });
  }

  test("AC-36: поле даты в форме плана — ГГГГ-ММ-ДД, на сервер уходит то же значение", async ({ page, isMobile }) => {
    await openLesson(page);
    const dialog = await openPlans(page, isMobile, HAFIZ_DATED);
    await entry(dialog, DATED_PLAN.shown).getByRole("button", { name: tr("common.edit"), exact: true }).click();
    await expect(dialog.getByLabel(tr("hifz.target_start_date"))).toHaveValue(DATED_PLAN.start);
    await expect(dialog.getByLabel(tr("hifz.target_end_date"))).toHaveValue(DATED_PLAN.end);
    const patch = page.waitForRequest((r) => r.method() === "PATCH" && /\/hifz\/targets\/\d+$/.test(r.url()));
    await dialog.getByRole("button", { name: tr("hifz.target_save"), exact: true }).click();
    const body = (await patch).postDataJSON();
    expect(body.start_date).toBe(DATED_PLAN.start);
    expect(body.end_date).toBe(DATED_PLAN.end);
    await expect(entry(dialog, DATED_PLAN.shown)).toBeVisible();
  });

  test("AC-41: в меню (телефон) и шапке (компьютер) — ФИО хафиз-учителя, логина нет", async ({ page, isMobile }) => {
    await loginAs(page, ROLE);
    if (isMobile) {
      await page.getByRole("button", { name: tr("nav.menu") }).click();
      await expect(page.getByText(USERS.hafiz.fullName, { exact: true })).toBeVisible();
      await expect(page.getByText(tr("users.role_teacher"), { exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole("banner")).toContainText(`${USERS.hafiz.fullName} · ${tr("users.role_teacher")}`);
    }
    await expect(page.getByText(USERS.hafiz.username, { exact: true })).toHaveCount(0);
  });
});
