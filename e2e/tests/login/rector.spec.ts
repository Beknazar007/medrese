// Вход в систему — ректор попадает на главную, а не в расписание учителя.
import { expect, loginAs, test, tr } from "../../fixtures/app";

test.describe("login — rector", () => {
  test("AC-1: ректор входит и видит главную страницу", async ({ page }) => {
    await loginAs(page, "rector");
    await expect(page.getByText(tr("nav.dashboard")).first()).toBeVisible();
  });
});
