// ux-fixes — учитель: название предмета в расписании (B1) и сообщение после смены пароля (B6).
// Спека: specs/ux-fixes.md. Данные — e2e/fixtures/seed.py (E2E_EXTRA_DATA=1 для teacher3 и pwd_*).
import { API_URL, authHeader, expect, loginAs, test, tr } from "../../fixtures/app";
import { PASSWORD } from "../../fixtures/users";
import { changePassword, expectPasswordChangedMessage, standDays } from "./stand";

const ROLE = "teacher" as const;
const [D1, D2] = standDays();

// Lessons of «Мамытов Азамат» in seed.py: Фикх today, Акыйда on d1, Араб тили on d2.
const MY_LESSONS = [
  { subject: "Фикх", group: "Кары 1", day: null },
  { subject: "Акыйда", group: "Кары 1", day: D1 },
  { subject: "Араб тили", group: "Кары 2", day: D2 },
] as const;

test.describe(`ux-fixes — ${ROLE}`, () => {
  test.describe("расписание", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, ROLE);
    });

    test("AC-1: на телефоне у каждого урока первая строка — название предмета, под ним группа и кабинет", async ({ page, isMobile }) => {
      test.skip(!isMobile, "сценарий для телефона");
      for (const lesson of MY_LESSONS) {
        if (lesson.day) await page.getByRole("button", { name: tr(`days.${lesson.day}`), exact: true }).click();
        const subject = page.getByText(lesson.subject, { exact: true });
        await expect(subject).toBeVisible();
        const card = subject.locator("xpath=..");
        // The subject is the card's first line; the group and room chips follow it.
        await expect(card.locator("> *").first()).toHaveText(lesson.subject);
        await expect(card.getByText(lesson.group, { exact: true })).toBeVisible();
      }
    });

    test("AC-2: на компьютере в каждой ячейке с уроком есть название предмета", async ({ page, isMobile }) => {
      test.skip(isMobile, "таблица на неделю — экран ≥ 900 px");
      const table = page.getByRole("table");
      await expect(table).toBeVisible();
      for (const lesson of MY_LESSONS) {
        await expect(table.getByText(lesson.subject, { exact: true })).toBeVisible();
      }
    });

    test("AC-3: в окне урока в строке «Сабак:» стоит название предмета", async ({ page }) => {
      await page.getByText("Фикх", { exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(`${tr("schedule.field_subject")} Фикх`, { exact: true })).toBeVisible();
    });

    test("AC-6, AC-31: нет кнопок изменения расписания, сервер отвечает 403 на запись назначений", async ({ page, isMobile }) => {
      await expect(page.getByText("Фикх", { exact: true })).toBeVisible();
      await expect(page.getByText(tr("schedule.add_hint"), { exact: true })).toHaveCount(0);
      await page.getByText("Фикх", { exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("button", { name: tr("common.close") })).toBeVisible();
      await expect(dialog.getByRole("button", { name: tr("schedule.move") })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: tr("common.remove") })).toHaveCount(0);
      await dialog.getByRole("button", { name: tr("common.close") }).click();

      const headers = await authHeader(page);
      const mine = await page.request.get(`${API_URL}/assignments`, { headers });
      const id = (await mine.json())[0].id as number;
      const create = await page.request.post(`${API_URL}/assignments`, {
        headers,
        data: { teacher_id: 1, subject_id: 1, group_id: 1, semester_id: 1, hour_type: "LECTURE" },
      });
      expect(create.status()).toBe(403);
      const patch = await page.request.patch(`${API_URL}/assignments/${id}`, { headers, data: { hour_type: "LAB" } });
      expect(patch.status()).toBe(403);
      const remove = await page.request.delete(`${API_URL}/assignments/${id}`, { headers });
      expect(remove.status()).toBe(403);

      // The assignments page is not for teachers: a direct link leads back to the schedule.
      if (!isMobile) {
        await page.goto("/assignments");
        await expect(page).toHaveURL(/\/schedule$/);
      }
    });

    test("AC-5: учитель получает только свои назначения", async ({ page }) => {
      const headers = await authHeader(page);
      const list = (await (await page.request.get(`${API_URL}/assignments`, { headers })).json()) as { teacher_id: number }[];
      // Фикх, Акыйда, Араб тили — nothing of teacher2/teacher3/…
      expect(list).toHaveLength(3);
      expect(new Set(list.map((a) => a.teacher_id)).size).toBe(1);
    });
  });

  test("AC-4: предмет и группа другой кафедры видны в расписании учителя", async ({ page, isMobile }) => {
    // teacher3 (Илим бөлүмү) teaches «Тажвид» to «Даярдоо 1» — both belong to Хафиздик бөлүмү.
    await loginAs(page, "teacher3");
    if (isMobile) await page.getByRole("button", { name: tr(`days.${D2}`), exact: true }).click();
    await expect(page.getByText("Тажвид", { exact: true })).toBeVisible();
    await expect(page.getByText("Даярдоо 1", { exact: true })).toBeVisible();
  });

  test.describe("смена пароля", () => {
    test("AC-33, AC-35, AC-36: сообщение после смены из баннера и из меню (телефон), баннер скрыт", async ({ page, isMobile }) => {
      test.skip(!isMobile, "меню и баннер — телефон; иконка в шапке проверяется на компьютере");
      await loginAs(page, "pwd_teacher_mobile");
      const banner = page.getByRole("alert").filter({ hasText: tr("password.recommend_banner") });
      await expect(banner).toBeVisible();
      await banner.getByRole("button", { name: tr("password.recommend_action"), exact: true }).click();
      const dialog = await changePassword(page, PASSWORD, "newpass1");
      await expect(dialog).toBeHidden();
      await expectPasswordChangedMessage(page);
      await expect(banner).toBeHidden();

      // From the phone menu — and back to the stand password, so a rerun can still log in.
      await page.getByRole("button", { name: tr("nav.menu") }).click();
      await page.getByRole("button", { name: tr("nav.change_password"), exact: true }).click();
      await changePassword(page, "newpass1", PASSWORD);
      await expectPasswordChangedMessage(page);
    });

    test("AC-33, AC-35, AC-36: сообщение после смены из иконки в шапке (компьютер), баннер скрыт", async ({ page, isMobile }) => {
      test.skip(isMobile, "иконка в шапке — только на широком экране");
      await loginAs(page, "pwd_teacher_desktop");
      const banner = page.getByRole("alert").filter({ hasText: tr("password.recommend_banner") });
      await expect(banner).toBeVisible();
      // The key icon in the app bar (the banner has a button with the same text).
      const headerButton = page.getByRole("banner").getByRole("button", { name: tr("nav.change_password"), exact: true });
      await headerButton.click();
      await changePassword(page, PASSWORD, "newpass1");
      await expectPasswordChangedMessage(page);
      await expect(banner).toBeHidden();
      await headerButton.click();
      await changePassword(page, "newpass1", PASSWORD);
      await expectPasswordChangedMessage(page);
    });

    test("AC-34: при ошибке сообщения об успехе нет, окно остаётся открытым", async ({ page, isMobile }) => {
      await loginAs(page, ROLE);
      if (isMobile) await page.getByRole("button", { name: tr("nav.menu") }).click();
      // The main teacher account has no "recommend changing" banner, so the name is unique here.
      await page.getByRole("button", { name: tr("nav.change_password"), exact: true }).click();

      const cases = [
        { current: "wrong-password", next: "newpass1", confirm: "newpass1", error: tr("errors.current_password_incorrect") },
        { current: PASSWORD, next: "newpass1", confirm: "newpass2", error: tr("password.mismatch") },
        { current: PASSWORD, next: "abc", confirm: "abc", error: tr("password.too_short") },
      ];
      for (const c of cases) {
        const dialog = await changePassword(page, c.current, c.next, c.confirm);
        await expect(dialog.getByText(c.error)).toBeVisible();
        await expect(dialog).toBeVisible();
        await expect(page.getByText(tr("password.changed"), { exact: true })).toHaveCount(0);
      }
    });
  });
});
