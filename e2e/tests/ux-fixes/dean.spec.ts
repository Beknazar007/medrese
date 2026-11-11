// ux-fixes — декан (заведует «Хафиздик бөлүмү»): назначения только своей кафедры (B5, крит. 30),
// семестр по умолчанию (крит. 24), «Өзгөртүү» (крит. 26), семестрами не управляет (крит. 23).
// Спека: specs/ux-fixes.md. Данные — e2e/fixtures/seed.py.
import type { APIRequestContext } from "@playwright/test";
import { API_URL, authHeader, expect, loginAs, test, tr } from "../../fixtures/app";
import { PASSWORD } from "../../fixtures/users";
import { formDialog } from "./stand";

const ROLE = "dean" as const;

/** Rector's view of the stand — to find ids of records the dean must not be able to touch. */
async function rectorApi(request: APIRequestContext) {
  const login = await request.post(`${API_URL}/auth/login`, { form: { username: "rector", password: PASSWORD } });
  const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };
  const teachers = (await (await request.get(`${API_URL}/teachers`, { headers })).json()) as { id: number; full_name: string }[];
  const assignments = (await (await request.get(`${API_URL}/assignments`, { headers })).json()) as { id: number; teacher_id: number }[];
  const teacherId = (name: string) => teachers.find((t) => t.full_name === name)!.id;
  const assignmentOf = (name: string) => assignments.find((a) => a.teacher_id === teacherId(name))!.id;
  return { teacherId, assignmentOf };
}

test.describe(`ux-fixes — ${ROLE}`, () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ROLE);
  });

  test("AC-30: в форме назначения декан видит только преподавателей, предметы и группы своей кафедры", async ({ page }) => {
    await page.goto("/assignments");
    await page.getByRole("button", { name: tr("common.add"), exact: true }).first().click();
    const dialog = formDialog(page);
    const options = async (key: string) => {
      await dialog.getByRole("combobox", { name: tr(key), exact: true }).click();
      const names = await page.getByRole("option").allTextContents();
      await page.keyboard.press("Escape");
      return names;
    };
    const teachers = await options("assignments.field_teacher");
    expect(teachers).toContain("Абдыкадыров Ислам");
    expect(teachers).not.toContain("Мамытов Азамат");
    const subjects = await options("assignments.field_subject");
    expect(subjects).toEqual(expect.arrayContaining(["Хифз (HIF1)", "Тажвид (TJW1)"]));
    expect(subjects).not.toContain("Фикх (FIQ1)");
    const groups = await options("assignments.field_group");
    expect(groups).toEqual(expect.arrayContaining(["Хафиз 1", "Даярдоо 1"]));
    expect(groups).not.toContain("Кары 1");
  });

  test("AC-24: в новом назначении декана уже стоит активный семестр", async ({ page }) => {
    await page.goto("/assignments");
    await page.getByRole("button", { name: tr("common.add"), exact: true }).first().click();
    await expect(formDialog(page).getByRole("combobox", { name: tr("assignments.field_semester"), exact: true })).toHaveValue("2026 Күз");
  });

  test("AC-26: у назначения своей кафедры есть «Өзгөртүү», форма с текущими значениями", async ({ page, isMobile }) => {
    await page.goto("/assignments");
    const edit = page.getByRole("button", { name: tr("common.edit"), exact: true });
    // Table row on a computer, a card with labeled buttons on a phone.
    const holder = isMobile
      ? page.locator("div").filter({ hasText: "Абдыкадыров Ислам" }).filter({ has: edit }).last()
      : page.getByRole("row").filter({ hasText: "Абдыкадыров Ислам" });
    await holder.getByRole("button", { name: tr("common.edit"), exact: true }).click();
    const dialog = formDialog(page);
    await expect(dialog.getByText(tr("common.edit_title").replace("{{title}}", tr("assignments.title")))).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: tr("assignments.field_teacher"), exact: true })).toHaveValue("Абдыкадыров Ислам");
    await expect(dialog.getByRole("combobox", { name: tr("assignments.field_subject"), exact: true })).toHaveValue("Хифз (HIF1)");
  });

  test("AC-30, B5.R6: сервер не даёт декану менять чужое назначение и ставить преподавателя чужой кафедры", async ({ page }) => {
    const rector = await rectorApi(page.request);
    const headers = await authHeader(page);
    // «Жээнбеков Канат» is from Илим бөлүмү — not the dean's department.
    const foreign = await page.request.patch(`${API_URL}/assignments/${rector.assignmentOf("Жээнбеков Канат")}`, {
      headers,
      data: { hour_type: "LAB" },
    });
    expect(foreign.status()).toBe(403);
    const own = rector.assignmentOf("Абдыкадыров Ислам");
    const toForeignTeacher = await page.request.patch(`${API_URL}/assignments/${own}`, {
      headers,
      data: { teacher_id: rector.teacherId("Мамытов Азамат") },
    });
    expect(toForeignTeacher.status()).toBe(403);
  });

  test("AC-23: декан не видит «Семестрлер», прямой адрес уводит, сервер отвечает 403", async ({ page, isMobile }) => {
    if (isMobile) await page.getByRole("button", { name: tr("nav.menu") }).click();
    await expect(page.getByRole("link", { name: tr("nav.assignments") })).toBeVisible();
    await expect(page.getByRole("link", { name: tr("nav.semesters") })).toHaveCount(0);
    await page.goto("/semesters");
    await expect(page).not.toHaveURL(/\/semesters$/);

    const headers = await authHeader(page);
    const create = await page.request.post(`${API_URL}/semesters`, {
      headers,
      data: { name: "Декандын семестри", start_date: "2027-02-01", end_date: "2027-06-30" },
    });
    expect(create.status()).toBe(403);
    const semesters = (await (await page.request.get(`${API_URL}/semesters`, { headers })).json()) as { id: number }[];
    const patch = await page.request.patch(`${API_URL}/semesters/${semesters[0].id}`, { headers, data: { name: "x" } });
    expect(patch.status()).toBe(403);
    const remove = await page.request.delete(`${API_URL}/semesters/${semesters[0].id}`, { headers });
    expect(remove.status()).toBe(403);
  });
});
