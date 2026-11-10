// ШАБЛОН e2e-теста. qa копирует его в e2e/tests/<feature>/<role>.spec.ts.
// Один файл = одна роль. Каждый test() проверяет один критерий приёмки из specs/<feature>.md
// и называется по нему: «AC-2: …». Локаторы — по ролям и текстам из i18n (tr), не по CSS.
// Данные — только со стенда (e2e/fixtures/seed.py). Прод не трогать никогда.
import { expect, loginAs, test, tr } from "../fixtures/app";

// Роль этого файла: rector | dean | teacher | hafiz
const ROLE = "teacher" as const;

test.describe(`<feature> — ${ROLE}`, () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ROLE);
  });

  test("AC-1: <что видит или делает пользователь>", async ({ page }) => {
    // Действие — так, как его делает человек
    await page.getByRole("button", { name: tr("nav.menu") }).click();
    // Проверка результата, видимого пользователю
    await expect(page.getByText(tr("nav.my_class"))).toBeVisible();
  });

  test("AC-2: <роль без прав не видит / получает отказ>", async ({ page }) => {
    // Права проверяет сервер: открываем адрес напрямую, а не ищем скрытую кнопку
    await page.goto("/<адрес-чужой-роли>");
    await expect(page).not.toHaveURL(/<адрес-чужой-роли>/);
  });
});

// Если тест только для телефона или только для компьютера:
// test.skip(({ isMobile }) => !isMobile, "сценарий учителя — телефон");
