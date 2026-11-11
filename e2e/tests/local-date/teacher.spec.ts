// «Сегодня» по Бишкеку, а не по UTC: с 00:00 до 06:00 UTC ещё вчерашний день.
// Часы браузера ставим на 02:30 по Бишкеку — до исправления «Менин классым» открывался на вчера.
import { expect, loginAs, test, tr } from "../../fixtures/app";
import { bishkekNightClock } from "./clock";

const ROLE = "teacher" as const;

test.describe(`local-date — ${ROLE}`, () => {
  test.use({ timezoneId: "Asia/Bishkek" });

  test("AC-1: ночью «Менин классым» открывается на сегодняшнюю дату по Бишкеку", async ({ page }) => {
    const { today, at } = bishkekNightClock();
    await page.clock.setFixedTime(at);
    await loginAs(page, ROLE);
    await page.goto("/my-class");
    await expect(page.getByLabel(tr("journal.select_date"))).toHaveValue(today);
  });
});
