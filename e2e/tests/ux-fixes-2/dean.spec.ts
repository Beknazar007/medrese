// ux-fixes-2 — декан (заведует «Хафиздик бөлүмү»): формы своего отделения без вопроса «Сохранить?» (B8, крит. 15, 18),
// даты экзаменов хафиза только для чтения (B10), «Админ каттоолор» недоступна (B9, крит. 31), логин в шапке (B11).
// Спека: specs/ux-fixes-2.md. Данные — e2e/fixtures/seed.py; для расписания тест сам создаёт через API
// свою группу, предмет, аудиторию и назначение хафиз-учителя.
import type { Page } from "@playwright/test";
import { API_URL, authHeader, expect, loginAs, test, tr } from "../../fixtures/app";
import { formDialog, pick } from "../ux-fixes/stand";
import { DATED_EXAM, HAFIZ_DATED, question, rectorApi, standDays, statusLabel, track, uniq } from "./stand";

const ROLE = "dean" as const;
const [, , D3] = standDays();

function row(page: Page, ...texts: string[]) {
  let rows = page.getByRole("row");
  for (const text of texts) rows = rows.filter({ hasText: text });
  return rows;
}

test.describe(`ux-fixes-2 — ${ROLE}`, () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ROLE);
  });

  test("AC-12, AC-33, AC-37: в журнале-сетке хафиза нет кнопок посещаемости, экзамен «05.11.2026» только для чтения", async ({ page }) => {
    await page.goto("/hifz-journal");
    await expect(page.getByRole("tab", { name: tr("hifz.tab_lesson"), exact: true })).toHaveCount(0);
    const student = page.getByRole("row").filter({ hasText: HAFIZ_DATED });
    await expect(student).toBeVisible();
    for (const s of ["present", "absent", "late", "excused"] as const) {
      await expect(page.getByRole("button", { name: statusLabel(s), exact: true })).toHaveCount(0);
    }
    await student.getByRole("cell").nth(2).click();
    const dialog = page.getByRole("dialog").filter({ hasText: tr("hifz.exams_title").replace("{{name}}", HAFIZ_DATED) });
    await expect(dialog).toContainText(`${DATED_EXAM.shown} — ${DATED_EXAM.title}`);
    await expect(dialog).not.toContainText("2026-11-05");
    await expect(dialog.getByRole("button", { name: tr("hifz.exam_add"), exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: tr("common.edit"), exact: true })).toHaveCount(0);

    const api = await rectorApi(page.request);
    const res = await page.request.post(`${API_URL}/hifz/exams`, {
      headers: await authHeader(page),
      data: { student_id: await api.studentId(HAFIZ_DATED), date: "2026-11-05", title: "декан" },
    });
    expect(res.status()).toBe(403);
  });

  test("AC-31: декан не видит «Админ каттоолор», прямой адрес уводит, GET /users — 403", async ({ page, isMobile }) => {
    if (isMobile) await page.getByRole("button", { name: tr("nav.menu") }).click();
    await expect(page.getByRole("link", { name: tr("nav.groups") })).toBeVisible();
    await expect(page.getByRole("link", { name: tr("nav.admin_accounts") })).toHaveCount(0);
    if (isMobile) await page.keyboard.press("Escape");
    await page.goto("/users");
    await expect(page).not.toHaveURL(/\/users$/);
    expect((await page.request.get(`${API_URL}/users`, { headers: await authHeader(page) })).status()).toBe(403);
  });

  test("AC-42: у декана в шапке и меню — логин и «Кафедра башчысы», full_name = null", async ({ page, isMobile }) => {
    const me = await (await page.request.get(`${API_URL}/auth/me`, { headers: await authHeader(page) })).json();
    expect(me.full_name).toBeNull();
    expect(me.headed_department_id).not.toBeNull();
    if (isMobile) {
      await page.getByRole("button", { name: tr("nav.menu") }).click();
      await expect(page.getByText("dean", { exact: true })).toBeVisible();
      await expect(page.getByText(tr("users.role_dean"), { exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole("banner")).toContainText(`dean · ${tr("users.role_dean")}`);
    }
  });

  test.describe("данные меняются — только компьютер", () => {
    test.skip(({ isMobile }) => isMobile, "меняет данные — только в проекте desktop");

    test("AC-15 (C1): группа своего отделения создаётся и меняется без вопроса", async ({ page }) => {
      const posts = track(page, "POST", /\/api\/v1\/groups$/);
      const name = `Декан тобу ${uniq()}`;
      await page.goto("/groups");
      await page.getByRole("button", { name: tr("common.add"), exact: true }).first().click();
      let dialog = formDialog(page);
      await dialog.getByLabel(tr("groups.name")).fill(name);
      await dialog.getByLabel(tr("groups.specialty")).fill("Хифз");
      await dialog.getByLabel(tr("groups.course_year")).fill("1");
      await pick(page, dialog, tr("groups.department"), "Хафиздик бөлүмү");
      await pick(page, dialog, tr("groups.type"), tr("groups.type_regular"));
      await dialog.getByRole("button", { name: tr("common.save"), exact: true }).click();
      await expect(question(page)).toHaveCount(0);
      await expect(page.getByText(tr("common.created"), { exact: true })).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(row(page, name)).toHaveCount(1);
      expect(posts).toHaveLength(1);

      await row(page, name).getByRole("button", { name: tr("common.edit"), exact: true }).click();
      dialog = formDialog(page);
      await dialog.getByLabel(tr("groups.course_year")).fill("2");
      await dialog.getByRole("button", { name: tr("common.save"), exact: true }).click();
      await expect(question(page)).toHaveCount(0);
      await expect(page.getByText(tr("common.saved"), { exact: true })).toBeVisible();
      await expect(row(page, name).getByRole("cell", { name: "2", exact: true })).toBeVisible();
    });

    test("AC-18 (C5): декан добавляет урок своего отделения в расписание без вопроса", async ({ page }) => {
      const api = await rectorApi(page.request);
      const tag = uniq();
      const hafizDep = await api.departmentId("Хафиздик бөлүмү");
      const group = await api.post<{ id: number; name: string }>("/groups", {
        name: `Декан сынак ${tag}`, specialty: "e2e", course_year: 1, department_id: hafizDep,
      });
      const subject = await api.post<{ id: number; name: string }>("/subjects", { name: `Декан сабагы ${tag}`, code: `D2E${tag}`, department_id: hafizDep });
      const room = await api.post<{ id: number; name: string }>("/rooms", { name: `Д${tag}`, building: "B" });
      await api.post("/assignments", {
        teacher_id: await api.teacherId("Абдыкадыров Ислам"), subject_id: subject.id, group_id: group.id,
        semester_id: await api.activeSemesterId(), hour_type: "LECTURE",
      });

      const posts = track(page, "POST", /\/api\/v1\/schedule$/);
      await page.goto("/schedule");
      await page.getByRole("combobox", { name: tr("common.group_filter") }).click();
      await page.getByRole("option", { name: group.name, exact: true }).click();
      const cell = page.getByRole("table").getByRole("row").nth(3).getByRole("cell").nth(D3);
      await cell.getByText(tr("schedule.add_hint"), { exact: true }).click();
      const dialog = page.getByRole("dialog").filter({ hasText: tr("schedule.add_title") });
      await dialog.getByRole("combobox", { name: tr("schedule.pick_assignment") }).click();
      await page.getByRole("option", { name: new RegExp(subject.name) }).click();
      await dialog.getByRole("combobox", { name: tr("schedule.pick_room") }).click();
      await page.getByRole("option", { name: `${room.name} (B)`, exact: true }).click();
      await dialog.getByRole("button", { name: tr("common.add"), exact: true }).click();
      await expect(question(page)).toHaveCount(0);
      await expect(cell.getByText(subject.name, { exact: true })).toBeVisible();
      expect(posts).toHaveLength(1);
    });
  });
});
