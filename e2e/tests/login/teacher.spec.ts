// Вход в систему — учитель. Первый e2e-тест и пример для qa.
import { expect, loginAs, test, tr } from "../../fixtures/app";
import { PASSWORD, USERS } from "../../fixtures/users";

test.describe("login — teacher", () => {
  test("AC-1: учитель входит и попадает в своё расписание", async ({ page }) => {
    await loginAs(page, "teacher");
    await expect(page.getByText(tr("nav.schedule")).first()).toBeVisible();
  });

  test("AC-2: при неверном пароле видно понятное сообщение", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(tr("login.username")).fill(USERS.teacher.username);
    await page.getByLabel(tr("login.password")).fill(`${PASSWORD}-wrong`);
    await page.getByRole("button", { name: tr("login.submit") }).click();
    await expect(page.getByText(tr("login.error"))).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("AC-3: интерфейс на русском, если выбран русский", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("i18nextLng", "ru"));
    await page.goto("/login");
    await expect(page.getByRole("button", { name: tr("login.submit", "ru") })).toBeVisible();
  });
});
