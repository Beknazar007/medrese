// ux-fixes-2 — ректор: справочники и расписание без вопроса «Сохранить?» и вопросы там, где они остались (B8),
// роль словом в «Админ каттоолор» (B9), даты экзаменов хафиза в журнале-сетке (B10), логин в шапке (B11).
// Спека: specs/ux-fixes-2.md. Данные — e2e/fixtures/seed.py; для расписания тест сам создаёт через API
// свою группу, предмет, аудиторию и назначение, чтобы не задеть уроки стенда.
// Тесты, которые меняют данные, идут только в проекте desktop (экраны ректора — компьютер).
import type { Page } from "@playwright/test";
import { API_URL, authHeader, expect, loginAs, test, tr, type Lang } from "../../fixtures/app";
import { formDialog, pick } from "../ux-fixes/stand";
import { DATED_EXAM, HAFIZ_DATED, LANGS, question, rectorApi, standDays, statusLabel, switchLanguage, track, uniq } from "./stand";

const ROLE = "rector" as const;
const [, , D3] = standDays();

/** A table row (desktop) that contains every given text. */
function row(page: Page, ...texts: string[]) {
  let rows = page.getByRole("row");
  for (const text of texts) rows = rows.filter({ hasText: text });
  return rows;
}

/** The schedule grid cell (desktop): row = pair number, column = weekday. */
function gridCell(page: Page, pair: number, day: number) {
  return page.getByRole("table").getByRole("row").nth(pair).getByRole("cell").nth(day);
}

async function filterGroup(page: Page, group: string) {
  await page.getByRole("combobox", { name: tr("common.group_filter") }).click();
  await page.getByRole("option", { name: group, exact: true }).click();
}

const ROLE_WORDS: Record<Lang, { rector: string; dean: string }> = {
  ky: { rector: "Ректор", dean: "Кафедра башчысы" },
  ru: { rector: "Ректор", dean: "Заведующий кафедрой" },
  en: { rector: "Rector", dean: "Dean" },
};

test.describe(`ux-fixes-2 — ${ROLE}`, () => {
  test.beforeEach(async ({ page, lang }) => {
    await loginAs(page, ROLE, lang);
  });

  test("AC-12, AC-33, AC-37: в журнале-сетке хафиза нет кнопок посещаемости, экзамен «05.11.2026» только для чтения", async ({ page }) => {
    await page.goto("/hifz-journal");
    await expect(page.getByRole("tab", { name: tr("hifz.tab_journal"), exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: tr("hifz.tab_lesson"), exact: true })).toHaveCount(0);
    await expect(page.getByRole("row").filter({ hasText: HAFIZ_DATED })).toBeVisible();
    for (const s of ["present", "absent", "late", "excused"] as const) {
      await expect(page.getByRole("button", { name: statusLabel(s), exact: true })).toHaveCount(0);
    }
    await page.getByRole("row").filter({ hasText: HAFIZ_DATED }).getByRole("cell").nth(2).click();
    const dialog = page.getByRole("dialog").filter({ hasText: tr("hifz.exams_title").replace("{{name}}", HAFIZ_DATED) });
    await expect(dialog).toContainText(`${DATED_EXAM.shown} — ${DATED_EXAM.title}`);
    await expect(dialog).not.toContainText("2026-11-05");
    await expect(dialog.getByRole("button", { name: tr("hifz.exam_add"), exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: tr("common.edit"), exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: tr("common.remove"), exact: true })).toHaveCount(0);

    const headers = await authHeader(page);
    const api = await rectorApi(page.request);
    const res = await page.request.post(`${API_URL}/hifz/exams`, {
      headers,
      data: { student_id: await api.studentId(HAFIZ_DATED), date: "2026-11-05", title: "ректор" },
    });
    expect(res.status()).toBe(403);
  });

  for (const lang of LANGS) {
    test.describe(`язык ${lang}`, () => {
      test.use({ lang });

      test(`AC-27, AC-28: роль словом — «${ROLE_WORDS[lang].rector}», «${ROLE_WORDS[lang].dean}», без RECTOR/DEAN (${lang})`, async ({ page, isMobile }) => {
        await page.goto("/users");
        await expect(page.getByText("dean", { exact: true })).toBeVisible();
        if (isMobile) {
          // Phone cards: "Кызматы: Кафедра башчысы".
          await expect(page.getByText(`${tr("users.role", lang)}: ${ROLE_WORDS[lang].dean}`, { exact: true })).toBeVisible();
          await expect(page.getByText(`${tr("users.role", lang)}: ${ROLE_WORDS[lang].rector}`, { exact: true }).first()).toBeVisible();
        } else {
          const deanRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "dean", exact: true }) });
          await expect(deanRow.getByRole("cell", { name: ROLE_WORDS[lang].dean, exact: true })).toBeVisible();
          const rectorRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "rector", exact: true }) });
          await expect(rectorRow.getByRole("cell", { name: ROLE_WORDS[lang].rector, exact: true })).toBeVisible();
        }
        await expect(page.getByText(/^(RECTOR|DEAN)$/)).toHaveCount(0);
        await expect(page.locator("main")).not.toContainText(/\b(RECTOR|DEAN)\b/);
      });
    });
  }

  test("AC-29: смена языка меняет подписи ролей без перезагрузки", async ({ page, isMobile }) => {
    await page.goto("/users");
    await expect(page.getByText("dean", { exact: true })).toBeVisible();
    await page.evaluate(() => ((window as unknown as { __noReload: number }).__noReload = 1));
    for (const lang of ["ru", "en", "ky"] as const) {
      await switchLanguage(page, isMobile, lang);
      await expect(page.locator("main")).toContainText(ROLE_WORDS[lang].dean);
    }
    expect(await page.evaluate(() => (window as unknown as { __noReload?: number }).__noReload)).toBe(1);
  });

  test("AC-30: роль без перевода показана как «—», а не служебным значением", async ({ page, isMobile }) => {
    test.skip(isMobile, "на телефоне пустые поля («—») в карточке не показываются");
    await page.route(/\/api\/v1\/users$/, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({ json: [{ id: 999, username: "ghost_user", email: null, role: "OTHER", is_active: true }] });
    });
    await page.goto("/users");
    const ghost = row(page, "ghost_user");
    await expect(ghost.getByRole("cell", { name: "—", exact: true }).last()).toBeVisible();
    await expect(page.getByText("OTHER")).toHaveCount(0);
  });

  test("AC-38, AC-42: у ректора full_name = null, в шапке и меню — логин и «Ректор»", async ({ page, isMobile }) => {
    const me = await (await page.request.get(`${API_URL}/auth/me`, { headers: await authHeader(page) })).json();
    expect(me.full_name).toBeNull();
    expect(me.role).toBe("RECTOR");
    if (isMobile) {
      await page.getByRole("button", { name: tr("nav.menu") }).click();
      await expect(page.getByText("rector", { exact: true })).toBeVisible();
      await expect(page.getByText(tr("users.role_rector"), { exact: true }).first()).toBeVisible();
    } else {
      await expect(page.getByRole("banner")).toContainText(`rector · ${tr("users.role_rector")}`);
    }
  });

  test("AC-44: исправленное ректором ФИО учитель видит после следующего входа", async ({ page, isMobile }) => {
    const api = await rectorApi(page.request);
    const id = await api.teacherId("Садыков Эрлан");
    const renamed = `Садыков Эрлан Уулу ${uniq()}`;
    const patch = await page.request.patch(`${API_URL}/teachers/${id}`, { headers: api.headers, data: { full_name: renamed } });
    expect(patch.ok(), await patch.text()).toBeTruthy();
    try {
      await page.evaluate(() => localStorage.removeItem("access_token"));
      await loginAs(page, "teacher2");
      if (isMobile) {
        await page.getByRole("button", { name: tr("nav.menu") }).click();
        await expect(page.getByText(renamed, { exact: true })).toBeVisible();
      } else {
        await expect(page.getByRole("banner")).toContainText(`${renamed} · ${tr("users.role_teacher")}`);
      }
    } finally {
      await page.request.patch(`${API_URL}/teachers/${id}`, { headers: api.headers, data: { full_name: "Садыков Эрлан" } });
    }
  });

  test.describe("данные меняются — только компьютер", () => {
    test.skip(({ isMobile }) => isMobile, "меняет данные — только в проекте desktop");

    test("AC-14, AC-22 (C1): аудитория создаётся и меняется без вопроса; двойное нажатие — одна запись", async ({ page }) => {
      const posts = track(page, "POST", /\/api\/v1\/rooms$/);
      const name = `Ауд ${uniq()}`;
      await page.goto("/rooms");
      await page.getByRole("button", { name: tr("common.add"), exact: true }).first().click();
      let dialog = formDialog(page);
      await expect(dialog.getByText(tr("common.new_title").replace("{{title}}", tr("rooms.title")))).toBeVisible();
      await dialog.getByLabel(tr("rooms.name")).fill(name);
      await dialog.getByLabel(tr("rooms.building")).fill("B");
      await dialog.getByRole("button", { name: tr("common.save"), exact: true }).click();
      await expect(question(page)).toHaveCount(0);
      await expect(page.getByText(tr("common.created"), { exact: true })).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(row(page, name)).toHaveCount(1);
      expect(posts).toHaveLength(1);

      await row(page, name).getByRole("button", { name: tr("common.edit"), exact: true }).click();
      dialog = formDialog(page);
      await dialog.getByLabel(tr("rooms.capacity")).fill("24");
      await dialog.getByRole("button", { name: tr("common.save"), exact: true }).click();
      await expect(question(page)).toHaveCount(0);
      await expect(page.getByText(tr("common.saved"), { exact: true })).toBeVisible();
      await expect(row(page, name).getByRole("cell", { name: "24", exact: true })).toBeVisible();

      // Criterion 22: a double click on «Сактоо» sends one request and adds one row.
      const twice = `Ауд кош ${uniq()}`;
      await page.getByRole("button", { name: tr("common.add"), exact: true }).first().click();
      dialog = formDialog(page);
      await dialog.getByLabel(tr("rooms.name")).fill(twice);
      await dialog.getByLabel(tr("rooms.building")).fill("B");
      await dialog.getByRole("button", { name: tr("common.save"), exact: true }).dblclick();
      await expect(row(page, twice)).toHaveCount(1);
      await page.waitForTimeout(1_000);
      expect(posts).toHaveLength(2);
      await expect(row(page, twice)).toHaveCount(1);
    });

    test("AC-16: пустое обязательное поле подсвечено и запроса нет; ошибка сервера — в форме, данные на месте", async ({ page }) => {
      const roomPosts = track(page, "POST", /\/api\/v1\/rooms$/);
      await page.goto("/rooms");
      await page.getByRole("button", { name: tr("common.add"), exact: true }).first().click();
      let dialog = formDialog(page);
      await dialog.getByLabel(tr("rooms.building")).fill("B");
      await dialog.getByRole("button", { name: tr("common.save"), exact: true }).click();
      await expect(dialog.getByLabel(tr("rooms.name"))).toHaveAttribute("aria-invalid", "true");
      await expect(question(page)).toHaveCount(0);
      await expect(dialog).toBeVisible();
      expect(roomPosts).toEqual([]);
      await dialog.getByRole("button", { name: tr("common.cancel"), exact: true }).click();

      // A subject code that already exists (seed: FIQ1) — the server refuses.
      await page.goto("/subjects");
      await page.getByRole("button", { name: tr("common.add"), exact: true }).first().click();
      dialog = formDialog(page);
      await dialog.getByLabel(tr("subjects.name")).fill("Кайталанган код");
      await dialog.getByLabel(tr("subjects.code")).fill("FIQ1");
      await pick(page, dialog, tr("subjects.department"), "Илим бөлүмү");
      await dialog.getByRole("button", { name: tr("common.save"), exact: true }).click();
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel(tr("subjects.name"))).toHaveValue("Кайталанган код");
      await expect(dialog.getByLabel(tr("subjects.code"))).toHaveValue("FIQ1");
      await expect(page.getByText(tr("common.created"), { exact: true })).toHaveCount(0);
    });

    test("AC-17 (C2): смена преподавателя спрашивает; «Жокко чыгаруу» — запроса нет, форма открыта", async ({ page }) => {
      const patches = track(page, "PATCH", /\/api\/v1\/assignments\/\d+$/);
      await page.goto("/assignments");
      const r = row(page, "Садыков Эрлан", "Араб тили");
      await expect(r).toHaveCount(1);
      await r.getByRole("button", { name: tr("common.edit"), exact: true }).click();
      const dialog = formDialog(page);
      await pick(page, dialog, tr("assignments.field_teacher"), "Эсенов Бакыт");
      await dialog.getByRole("button", { name: tr("common.save"), exact: true }).click();
      await expect(question(page)).toContainText(tr("assignments.teacher_replace_warning"));
      await expect(question(page)).toContainText(tr("common.confirm_save"));
      await question(page).getByRole("button", { name: tr("common.cancel"), exact: true }).click();
      await expect(question(page)).toHaveCount(0);
      await page.waitForTimeout(300);
      expect(patches).toEqual([]);
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("combobox", { name: tr("assignments.field_teacher"), exact: true })).toHaveValue("Эсенов Бакыт");
      await dialog.getByRole("button", { name: tr("common.cancel"), exact: true }).click();
      await expect(row(page, "Садыков Эрлан", "Араб тили")).toHaveCount(1);
    });

    test("AC-18, AC-22 (C5, C6): урок добавляется в расписание без вопроса, двойное нажатие — один урок", async ({ page }) => {
      const api = await rectorApi(page.request);
      const tag = uniq();
      const ilim = await api.departmentId("Илим бөлүмү");
      const group = await api.post<{ id: number; name: string }>("/groups", {
        name: `Сынак тобу ${tag}`, specialty: "e2e", course_year: 1, department_id: ilim,
      });
      const subject = await api.post<{ id: number; name: string }>("/subjects", { name: `Сынак сабагы ${tag}`, code: `E2E${tag}`, department_id: ilim });
      const subject2 = await api.post<{ id: number; name: string }>("/subjects", { name: `Жаңы сабак ${tag}`, code: `E2N${tag}`, department_id: ilim });
      const room = await api.post<{ id: number; name: string }>("/rooms", { name: `Р${tag}`, building: "B" });
      await api.post("/assignments", {
        teacher_id: await api.teacherId("Садыков Эрлан"), subject_id: subject.id, group_id: group.id,
        semester_id: await api.activeSemesterId(), hour_type: "LECTURE",
      });

      const schedulePosts = track(page, "POST", /\/api\/v1\/schedule$/);
      await page.goto("/schedule");
      await filterGroup(page, group.name);

      // C5: from the existing assignment, double click on «Кошуу».
      await gridCell(page, 3, D3).getByText(tr("schedule.add_hint"), { exact: true }).click();
      let dialog = page.getByRole("dialog").filter({ hasText: tr("schedule.add_title") });
      await dialog.getByRole("combobox", { name: tr("schedule.pick_assignment") }).click();
      await page.getByRole("option", { name: new RegExp(subject.name) }).click();
      await dialog.getByRole("combobox", { name: tr("schedule.pick_room") }).click();
      await page.getByRole("option", { name: `${room.name} (B)`, exact: true }).click();
      await dialog.getByRole("button", { name: tr("common.add"), exact: true }).dblclick();
      await expect(question(page)).toHaveCount(0);
      await expect(page.getByText(tr("schedule.added"), { exact: true })).toBeVisible();
      await expect(gridCell(page, 3, D3).getByText(subject.name, { exact: true })).toHaveCount(1);
      await page.waitForTimeout(1_000);
      expect(schedulePosts).toHaveLength(1);

      // C6: with a new assignment.
      await gridCell(page, 2, D3).getByText(tr("schedule.add_hint"), { exact: true }).click();
      dialog = page.getByRole("dialog").filter({ hasText: tr("schedule.add_title") });
      await dialog.getByRole("button", { name: tr("schedule.mode_new"), exact: true }).click();
      for (const [key, option] of [
        ["assignments.field_teacher", "Жээнбеков Канат"],
        ["assignments.field_subject", subject2.name],
        ["assignments.field_group", group.name],
        ["assignments.field_type", tr("hour_type.LECTURE")],
      ] as const) {
        await dialog.getByRole("combobox", { name: tr(key) }).click();
        await page.getByRole("option", { name: new RegExp(`^${option}`) }).click();
      }
      await dialog.getByRole("combobox", { name: tr("schedule.pick_room") }).click();
      await page.getByRole("option", { name: `${room.name} (B)`, exact: true }).click();
      await dialog.getByRole("button", { name: tr("common.add"), exact: true }).click();
      await expect(question(page)).toHaveCount(0);
      await expect(gridCell(page, 2, D3).getByText(subject2.name, { exact: true })).toBeVisible();
      expect(schedulePosts).toHaveLength(2);
    });

    test("AC-23 (C3, C4): удаление в справочнике и удаление студента с записями спрашивают, «Жокко чыгаруу» не удаляет", async ({ page }) => {
      const api = await rectorApi(page.request);
      const room = await api.post<{ id: number; name: string }>("/rooms", { name: `Өчпө ${uniq()}`, building: "B" });
      const deletes = track(page, "DELETE", /\/api\/v1\/(rooms|students)\/\d+/);

      await page.goto("/rooms");
      await row(page, room.name).getByRole("button", { name: tr("common.remove"), exact: true }).click();
      const ask = page.getByRole("dialog").filter({ hasText: tr("common.confirm_delete") });
      await expect(ask).toBeVisible();
      await ask.getByRole("button", { name: tr("common.cancel"), exact: true }).click();
      await page.waitForTimeout(300);
      expect(deletes).toEqual([]);
      await expect(row(page, room.name)).toHaveCount(1);

      // C4: «Асанов Эмир» has attendance and grades → 409 → a second, stronger question.
      await page.goto("/students");
      await page.getByPlaceholder(tr("common.search")).fill("Асанов Эмир");
      await row(page, "Асанов Эмир").getByRole("button", { name: tr("common.remove"), exact: true }).click();
      await page.getByRole("dialog").filter({ hasText: tr("common.confirm_delete") }).getByRole("button", { name: tr("common.remove"), exact: true }).click();
      const force = question(page);
      await expect(force).toBeVisible();
      await expect(force.getByRole("button", { name: tr("common.force_remove_label"), exact: true })).toBeVisible();
      await force.getByRole("button", { name: tr("common.cancel"), exact: true }).click();
      await page.waitForTimeout(500);
      expect(deletes.filter((u) => u.includes("force"))).toEqual([]);
      await expect(row(page, "Асанов Эмир")).toHaveCount(1);
    });

    test("AC-23 (C7, C8): перенос и удаление урока спрашивают, «Жокко чыгаруу» ничего не меняет", async ({ page }) => {
      const patches = track(page, "PATCH", /\/api\/v1\/schedule\/\d+$/);
      const deletes = track(page, "DELETE", /\/api\/v1\/schedule\/\d+/);
      await page.goto("/schedule");
      await filterGroup(page, "Кары 1");
      const lesson = page.getByRole("table").getByText("Фикх", { exact: true });
      await lesson.click();
      let dialog = page.getByRole("dialog").filter({ hasText: tr("schedule.entry_title") });
      await dialog.getByRole("button", { name: tr("schedule.move"), exact: true }).click();
      await dialog.getByRole("button", { name: tr("schedule.move_save"), exact: true }).click();
      await expect(question(page)).toContainText(tr("common.confirm_save"));
      await question(page).getByRole("button", { name: tr("common.cancel"), exact: true }).click();
      await page.waitForTimeout(300);
      expect(patches).toEqual([]);
      await dialog.getByRole("button", { name: tr("common.cancel"), exact: true }).click();

      dialog = page.getByRole("dialog").filter({ hasText: tr("schedule.entry_title") });
      await dialog.getByRole("button", { name: tr("common.remove"), exact: true }).click();
      await expect(question(page)).toContainText(tr("common.confirm_delete"));
      await question(page).getByRole("button", { name: tr("common.cancel"), exact: true }).click();
      await page.waitForTimeout(300);
      expect(deletes).toEqual([]);
      await dialog.getByRole("button", { name: tr("common.close"), exact: true }).click();
      await expect(lesson).toBeVisible();
    });
  });
});
