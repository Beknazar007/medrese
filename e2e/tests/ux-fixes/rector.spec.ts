// ux-fixes — ректор: проверка обязательных полей и перевод ошибок (B2), пустые часы предмета (B3),
// переключатель «Активдүү» (B4), назначения: семестр по умолчанию, «Өзгөртүү», замена преподавателя (B5),
// сообщение после смены пароля (B6). Спека: specs/ux-fixes.md. Данные — e2e/fixtures/seed.py.
// Тесты, которые меняют данные стенда, идут только в проекте desktop (экраны ректора — компьютер),
// чтобы второй прогон (mobile) не упирался в уже изменённые записи.
import type { Page } from "@playwright/test";
import { expect, loginAs, test, tr } from "../../fixtures/app";
import { PASSWORD } from "../../fixtures/users";
import { changePassword, expectPasswordChangedMessage, formDialog, pick, saveAndConfirm, standDays, uniq } from "./stand";

const ROLE = "rector" as const;
const [D1] = standDays();
const ACTIVE_SEMESTER = "2026 Күз";
const OTHER_SEMESTER = "2026 Жаз";

/** A table row (desktop) that contains every given text. */
function row(page: Page, ...texts: string[]) {
  let rows = page.getByRole("row");
  for (const text of texts) rows = rows.filter({ hasText: text });
  return rows;
}

async function openAdd(page: Page, path: string) {
  await page.goto(path);
  await page.getByRole("button", { name: tr("common.add"), exact: true }).first().click();
  await expect(formDialog(page)).toBeVisible();
}

async function openEditRow(page: Page, ...texts: string[]) {
  const r = row(page, ...texts);
  await expect(r).toHaveCount(1);
  await r.getByRole("button", { name: tr("common.edit"), exact: true }).click();
  await expect(page.getByRole("dialog").getByText(tr("common.edit_title", "ky").replace("{{title}}", tr("assignments.title")))).toBeVisible();
}

async function search(page: Page, text: string) {
  await page.getByPlaceholder(tr("common.search")).fill(text);
}

test.describe(`ux-fixes — ${ROLE}`, () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ROLE);
  });

  test("AC-7: ректор видит в расписании название предмета и ФИО учителя", async ({ page, isMobile }) => {
    await page.goto("/schedule");
    await page.getByRole("combobox", { name: tr("common.group_filter") }).click();
    await page.getByRole("option", { name: "Кары 1", exact: true }).click();
    if (isMobile) {
      // Phones show one day: today's «Фикх» is in the all-day pair 1.
      await expect(page.getByText("Фикх", { exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole("table").getByText("Фикх", { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Мамытов Азамат").first()).toBeVisible();
  });

  test("AC-9: пустая обязательная дата подсвечена, вопроса «Сохранить?» и запроса нет", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/semesters")) posts.push(r.url());
    });
    await openAdd(page, "/semesters");
    const dialog = formDialog(page);
    await expect(dialog.getByText(tr("common.new_title").replace("{{title}}", tr("semesters.title")))).toBeVisible();
    await dialog.getByLabel(tr("semesters.name")).fill("Толук эмес семестр");
    await dialog.getByLabel(tr("semesters.end")).fill("2027-06-30");
    await dialog.getByRole("button", { name: tr("common.save"), exact: true }).click();

    const start = dialog.getByLabel(tr("semesters.start"));
    await expect(start).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByText(tr("validation.required"), { exact: true })).toHaveCount(1);
    await expect(page.getByText(tr("common.confirm_save"))).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(tr("semesters.name"))).toHaveValue("Толук эмес семестр");
    await expect(dialog.getByLabel(tr("semesters.end"))).toHaveValue("2027-06-30");
    expect(posts).toEqual([]);

    // The highlight goes away as soon as the field is filled.
    await start.fill("2027-02-01");
    await expect(start).not.toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByText(tr("validation.required"), { exact: true })).toHaveCount(0);
  });

  test("AC-10: пустые обязательные выбор из списка и число подсвечены", async ({ page }) => {
    await openAdd(page, "/assignments");
    let dialog = formDialog(page);
    await dialog.getByRole("button", { name: tr("common.save"), exact: true }).click();
    for (const key of ["assignments.field_teacher", "assignments.field_subject", "assignments.field_group", "assignments.field_type"]) {
      await expect(dialog.getByRole("combobox", { name: tr(key), exact: true })).toHaveAttribute("aria-invalid", "true");
    }
    // The semester is already filled in (criterion 24), so it is not highlighted.
    await expect(dialog.getByRole("combobox", { name: tr("assignments.field_semester"), exact: true })).not.toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByText(tr("validation.required"), { exact: true })).toHaveCount(4);
    await expect(page.getByText(tr("common.confirm_save"))).toHaveCount(0);
    await dialog.getByRole("button", { name: tr("common.cancel") }).click();

    await openAdd(page, "/groups");
    dialog = formDialog(page);
    await dialog.getByLabel(tr("groups.name")).fill("Бош курс");
    await dialog.getByRole("button", { name: tr("common.save"), exact: true }).click();
    await expect(dialog.getByLabel(tr("groups.course_year"))).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(tr("common.confirm_save"))).toHaveCount(0);
  });

  test("AC-11, AC-12, AC-18: отрицательные и дробные часы — понятная ошибка «поле: текст» без английского", async ({ page, isMobile }) => {
    test.skip(isMobile, "создаёт данные — только в проекте desktop");
    await openAdd(page, "/subjects");
    const dialog = formDialog(page);
    await dialog.getByLabel(tr("subjects.name")).fill("Терс саат");
    await dialog.getByLabel(tr("subjects.code")).fill(`NEG${uniq()}`);
    await pick(page, dialog, tr("subjects.department"), "Илим бөлүмү");
    await dialog.getByLabel(tr("subjects.practice_hours")).fill("-5");
    await saveAndConfirm(page);
    const alert = dialog.getByRole("alert");
    await expect(alert).toHaveText(`${tr("subjects.practice_hours")}: ${tr("validation.range")}`);
    await expect(dialog).not.toContainText("Input should");

    await dialog.getByLabel(tr("subjects.practice_hours")).fill("2.5");
    await saveAndConfirm(page);
    await expect(alert).toHaveText(`${tr("subjects.practice_hours")}: ${tr("validation.int")}`);
    await expect(dialog).not.toContainText("Input should");
    await expect(dialog).toBeVisible();
  });

  test("AC-14: предмет только с лекционными часами сохраняется с первого раза, практика и лаборатория = 0", async ({ page, isMobile }) => {
    test.skip(isMobile, "создаёт данные — только в проекте desktop");
    const code = `LEC${uniq()}`;
    await openAdd(page, "/subjects");
    const dialog = formDialog(page);
    await dialog.getByLabel(tr("subjects.name")).fill("Лекция гана");
    await dialog.getByLabel(tr("subjects.code")).fill(code);
    await pick(page, dialog, tr("subjects.department"), "Илим бөлүмү");
    await dialog.getByLabel(tr("subjects.lecture_hours")).fill("36");
    await saveAndConfirm(page);
    await expect(page.getByText(tr("common.created"), { exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();
    const cells = row(page, code).getByRole("cell");
    await expect(cells.nth(3)).toHaveText("36");
    await expect(cells.nth(4)).toHaveText("0");
    await expect(cells.nth(5)).toHaveText("0");
  });

  test("AC-15, AC-16: все часы пустые → 0; очищенная практика при изменении → 0", async ({ page, isMobile }) => {
    test.skip(isMobile, "создаёт данные — только в проекте desktop");
    const code = `NOH${uniq()}`;
    await openAdd(page, "/subjects");
    let dialog = formDialog(page);
    await dialog.getByLabel(tr("subjects.name")).fill("Саатсыз");
    await dialog.getByLabel(tr("subjects.code")).fill(code);
    await pick(page, dialog, tr("subjects.department"), "Илим бөлүмү");
    await saveAndConfirm(page);
    await expect(page.getByText(tr("common.created"), { exact: true })).toBeVisible();
    const cells = row(page, code).getByRole("cell");
    for (const i of [3, 4, 5]) await expect(cells.nth(i)).toHaveText("0");

    await row(page, code).getByRole("button", { name: tr("common.edit"), exact: true }).click();
    dialog = formDialog(page);
    await dialog.getByLabel(tr("subjects.practice_hours")).fill("7");
    await saveAndConfirm(page);
    await expect(cells.nth(4)).toHaveText("7");

    await row(page, code).getByRole("button", { name: tr("common.edit"), exact: true }).click();
    await dialog.getByLabel(tr("subjects.practice_hours")).fill("");
    await saveAndConfirm(page);
    await expect(page.getByText(tr("common.saved"), { exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(cells.nth(4)).toHaveText("0");
  });

  test("AC-19: семестр без касания «Активдүү» создаётся неактивным, текущий остаётся активным", async ({ page, isMobile }) => {
    test.skip(isMobile, "создаёт данные — только в проекте desktop");
    const name = `Сынак ${uniq()}`;
    await openAdd(page, "/semesters");
    const dialog = formDialog(page);
    await dialog.getByLabel(tr("semesters.name")).fill(name);
    await dialog.getByLabel(tr("semesters.start")).fill("2027-02-01");
    await dialog.getByLabel(tr("semesters.end")).fill("2027-06-30");
    await expect(dialog.getByLabel(tr("semesters.active"))).not.toBeChecked();
    await saveAndConfirm(page);
    await expect(page.getByText(tr("common.created"), { exact: true })).toBeVisible();
    await expect(row(page, name).getByRole("cell", { name: tr("common.no"), exact: true })).toBeVisible();
    await expect(row(page, ACTIVE_SEMESTER).getByRole("cell", { name: tr("common.yes"), exact: true })).toBeVisible();
  });

  test("AC-21: новый студент без касания «Активдүү» создаётся активным, переключатель показан включённым", async ({ page, isMobile }) => {
    test.skip(isMobile, "создаёт данные — только в проекте desktop");
    const name = `Сынак Студент ${uniq()}`;
    await openAdd(page, "/students");
    const dialog = formDialog(page);
    await expect(dialog.getByLabel(tr("students.active"))).toBeChecked();
    await dialog.getByLabel(tr("students.full_name")).fill(name);
    await pick(page, dialog, tr("students.group"), "Кары 1");
    await saveAndConfirm(page);
    await expect(page.getByText(tr("common.created"), { exact: true })).toBeVisible();
    await search(page, name);
    await expect(row(page, name).getByRole("cell", { name: tr("common.yes"), exact: true })).toBeVisible();
  });

  test("AC-24, AC-25: в новом назначении стоит активный семестр, а при фильтре — семестр из фильтра", async ({ page }) => {
    await openAdd(page, "/assignments");
    let dialog = formDialog(page);
    const semester = dialog.getByRole("combobox", { name: tr("assignments.field_semester"), exact: true });
    await expect(semester).toHaveValue(ACTIVE_SEMESTER);
    await dialog.getByRole("button", { name: tr("common.cancel") }).click();

    await page.getByRole("combobox", { name: tr("assignments.filter_semester") }).click();
    await page.getByRole("option", { name: OTHER_SEMESTER, exact: true }).click();
    await page.getByRole("button", { name: tr("common.add"), exact: true }).first().click();
    dialog = formDialog(page);
    await expect(dialog.getByRole("combobox", { name: tr("assignments.field_semester"), exact: true })).toHaveValue(OTHER_SEMESTER);
    // …and it can still be changed.
    await pick(page, dialog, tr("assignments.field_semester"), ACTIVE_SEMESTER);
  });

  test("AC-26: у назначения есть подписанная кнопка «Өзгөртүү», форма открывается с текущими значениями", async ({ page, isMobile }) => {
    await page.goto("/assignments");
    if (isMobile) {
      const card = page
        .locator("div")
        .filter({ hasText: "Эсенов Бакыт" })
        .filter({ hasText: "Сира" })
        .filter({ has: page.getByRole("button", { name: tr("common.edit"), exact: true }) })
        .last();
      await expect(card.getByRole("button", { name: tr("common.remove"), exact: true })).toBeVisible();
      await card.getByRole("button", { name: tr("common.edit"), exact: true }).click();
    } else {
      await openEditRow(page, "Эсенов Бакыт", "Сира");
    }
    const dialog = formDialog(page);
    await expect(dialog.getByText(tr("common.edit_title").replace("{{title}}", tr("assignments.title")))).toBeVisible();
    const value = (key: string) => dialog.getByRole("combobox", { name: tr(key), exact: true });
    await expect(value("assignments.field_teacher")).toHaveValue("Эсенов Бакыт");
    await expect(value("assignments.field_subject")).toHaveValue("Сира (SIR1)");
    await expect(value("assignments.field_group")).toHaveValue("Кары 3");
    await expect(value("assignments.field_semester")).toHaveValue(ACTIVE_SEMESTER);
    await expect(value("assignments.field_type")).toHaveValue(tr("hour_type.LECTURE"));
  });

  test.describe("изменение назначений", () => {
    test.skip(({ isMobile }) => isMobile, "меняет данные — только в проекте desktop");

    test("AC-27: назначение без расписания — меняются все пять полей", async ({ page }) => {
      await page.goto("/assignments");
      await openEditRow(page, "Эсенов Бакыт", "Сира");
      const dialog = formDialog(page);
      await pick(page, dialog, tr("assignments.field_teacher"), "Токтоматов Нурлан");
      await pick(page, dialog, tr("assignments.field_subject"), "Тарых (TAR1)");
      await pick(page, dialog, tr("assignments.field_group"), "Кары 1");
      await pick(page, dialog, tr("assignments.field_semester"), OTHER_SEMESTER);
      await pick(page, dialog, tr("assignments.field_type"), tr("hour_type.LAB"));
      const question = await saveAndConfirm(page);
      expect(question).toContain(tr("assignments.teacher_replace_warning"));
      await expect(page.getByText(tr("common.saved"), { exact: true })).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(row(page, "Токтоматов Нурлан", "Тарых", "Кары 1", OTHER_SEMESTER, tr("hour_type.LAB"))).toHaveCount(1);
    });

    test("AC-29: изменение, дающее дубль, отклоняется понятным сообщением", async ({ page }) => {
      await page.goto("/assignments");
      // teacher5 «Тарых» «Кары 2» → teacher4 «Сира» «Кары 2» already exists.
      await openEditRow(page, "Эсенов Бакыт", "Тарых", "Кары 2");
      const dialog = formDialog(page);
      await pick(page, dialog, tr("assignments.field_teacher"), "Токтоматов Нурлан");
      await pick(page, dialog, tr("assignments.field_subject"), "Сира (SIR1)");
      await saveAndConfirm(page);
      await expect(dialog.getByRole("alert")).toHaveText(tr("errors.teacher_already_assigned"));
      await expect(dialog).toBeVisible();
    });

    test("AC-28: в назначении из расписания меняется предмет (виден в расписании), смена группы — понятный отказ", async ({ page }) => {
      await page.goto("/assignments");
      await openEditRow(page, "Токтоматов Нурлан", "Тарых", tr("hour_type.PRACTICE"));
      let dialog = formDialog(page);
      await pick(page, dialog, tr("assignments.field_subject"), "Сира (SIR1)");
      const question = await saveAndConfirm(page);
      expect(question).not.toContain(tr("assignments.teacher_replace_warning"));
      await expect(page.getByText(tr("common.saved"), { exact: true })).toBeVisible();

      await page.goto("/schedule");
      await page.getByRole("combobox", { name: tr("common.group_filter") }).click();
      await page.getByRole("option", { name: "Кары 3", exact: true }).click();
      await expect(page.getByRole("table").getByText("Сира", { exact: true })).toBeVisible();

      await page.goto("/assignments");
      await openEditRow(page, "Токтоматов Нурлан", "Сира", tr("hour_type.PRACTICE"));
      dialog = formDialog(page);
      await pick(page, dialog, tr("assignments.field_group"), "Кары 1");
      await saveAndConfirm(page);
      await expect(dialog.getByRole("alert")).toHaveText(tr("errors.assignment_scheduled_fields"));
      await expect(dialog).toBeVisible();
    });

    test("B5.R1, B5.R2, B5.R4, B5.R5: замена преподавателя — предупреждение, накладка, уроки у нового", async ({ page }) => {
      await page.goto("/assignments");
      await openEditRow(page, "Жээнбеков Канат", "Тарых");
      const dialog = formDialog(page);

      // B5.R2: teacher4 already teaches «Кары 2» at the same pair.
      await pick(page, dialog, tr("assignments.field_teacher"), "Токтоматов Нурлан");
      let question = await saveAndConfirm(page);
      expect(question).toContain(tr("assignments.teacher_replace_warning"));
      const busySlot = tr("errors.busy_slot").replace("{{day}}", tr(`days.${D1}`)).replace("{{n}}", "3");
      await expect(dialog.getByRole("alert")).toHaveText(tr("errors.new_teacher_busy").replace("{{slots}}", busySlot));
      await expect(dialog).toBeVisible();

      // B5.R1, B5.R5: a free teacher replaces the old one.
      await pick(page, dialog, tr("assignments.field_teacher"), "Эсенов Бакыт");
      question = await saveAndConfirm(page);
      expect(question).toContain(tr("assignments.teacher_replace_warning"));
      await expect(page.getByText(tr("common.saved"), { exact: true })).toBeVisible();
      await expect(row(page, "Эсенов Бакыт", "Тарых", "Кары 3")).toHaveCount(1);
      await expect(row(page, "Жээнбеков Канат", "Тарых")).toHaveCount(0);

      // B5.R4: the new teacher sees the lesson, the previous one no longer does.
      await page.evaluate(() => localStorage.removeItem("access_token"));
      await loginAs(page, "teacher5");
      await expect(page.getByRole("table").getByText("Тарых", { exact: true })).toBeVisible();
      await page.evaluate(() => localStorage.removeItem("access_token"));
      await loginAs(page, "teacher3");
      await expect(page.getByRole("table").getByText("Тажвид", { exact: true })).toBeVisible();
      await expect(page.getByRole("table").getByText("Тарых", { exact: true })).toHaveCount(0);
    });
  });

  test("AC-33, AC-35: после смены пароля из иконки в шапке — «Сырсөз алмаштырылды», баннер скрыт", async ({ page, isMobile }) => {
    test.skip(isMobile, "иконка в шапке — только на широком экране");
    await page.evaluate(() => localStorage.removeItem("access_token"));
    await loginAs(page, "pwd_rector");
    const banner = page.getByRole("alert").filter({ hasText: tr("password.recommend_banner") });
    await expect(banner).toBeVisible();
    const headerButton = page.getByRole("banner").getByRole("button", { name: tr("nav.change_password"), exact: true });
    await headerButton.click();
    await changePassword(page, PASSWORD, "newpass1");
    await expectPasswordChangedMessage(page);
    await expect(banner).toBeHidden();
    await headerButton.click();
    await changePassword(page, "newpass1", PASSWORD);
    await expectPasswordChangedMessage(page);
  });

  // Last: it moves the "active" mark away from the stand semester, then puts it back.
  test("AC-20: включённый «Активдүү» делает новый семестр активным, остальные — неактивными", async ({ page, isMobile }) => {
    test.skip(isMobile, "меняет активный семестр — только в проекте desktop");
    const name = `Активдүү ${uniq()}`;
    await openAdd(page, "/semesters");
    const dialog = formDialog(page);
    await dialog.getByLabel(tr("semesters.name")).fill(name);
    await dialog.getByLabel(tr("semesters.start")).fill("2027-02-01");
    await dialog.getByLabel(tr("semesters.end")).fill("2027-06-30");
    await dialog.getByLabel(tr("semesters.active")).check();
    await saveAndConfirm(page);
    await expect(page.getByText(tr("common.created"), { exact: true })).toBeVisible();
    await expect(row(page, name).getByRole("cell", { name: tr("common.yes"), exact: true })).toBeVisible();
    await expect(row(page, ACTIVE_SEMESTER).getByRole("cell", { name: tr("common.no"), exact: true })).toBeVisible();

    // Put the stand back: «2026 Күз» active again.
    await row(page, ACTIVE_SEMESTER).getByRole("button", { name: tr("common.edit"), exact: true }).click();
    await formDialog(page).getByLabel(tr("semesters.active")).check();
    await saveAndConfirm(page);
    await expect(row(page, ACTIVE_SEMESTER).getByRole("cell", { name: tr("common.yes"), exact: true })).toBeVisible();
    await expect(row(page, name).getByRole("cell", { name: tr("common.no"), exact: true })).toBeVisible();
  });
});

test.describe(`ux-fixes — ${ROLE} — на русском`, () => {
  test.use({ lang: "ru" });
  test.skip(({ isMobile }) => isMobile, "создаёт данные — только в проекте desktop");

  test("AC-12, AC-37: ошибки формы на русском, без сырых текстов Pydantic", async ({ page }) => {
    await loginAs(page, ROLE, "ru");
    await page.goto("/subjects");
    await page.getByRole("button", { name: tr("common.add", "ru"), exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: tr("common.save", "ru"), exact: true }).click();
    await expect(dialog.getByText(tr("validation.required", "ru"), { exact: true }).first()).toBeVisible();

    await dialog.getByLabel(tr("subjects.name", "ru")).fill("Отрицательные часы");
    await dialog.getByLabel(tr("subjects.code", "ru")).fill(`RU${uniq()}`);
    await pick(page, dialog, tr("subjects.department", "ru"), "Илим бөлүмү");
    await dialog.getByLabel(tr("subjects.lab_hours", "ru")).fill("-1");
    await saveAndConfirm(page, "ru");
    await expect(dialog.getByRole("alert")).toHaveText(`${tr("subjects.lab_hours", "ru")}: ${tr("validation.range", "ru")}`);
    for (const raw of ["Input should", "Field required", "value is not a valid"]) await expect(dialog).not.toContainText(raw);
  });
});
