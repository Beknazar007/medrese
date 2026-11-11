// Фильтр периода на «Мониторинге»: начало месяца/года — это местная полночь. Через toISOString()
// она превращалась в последний день прошлого месяца/года в любое время суток; ночью и «Күн» был вчера.
import { expect, loginAs, test, tr } from "../../fixtures/app";
import { bishkekNightClock } from "./clock";

const ROLE = "rector" as const;

test.describe(`local-date — ${ROLE}`, () => {
  test.use({ timezoneId: "Asia/Bishkek" });
  test.skip(({ isMobile }) => isMobile, "мониторинг — экран руководства, компьютер");

  test("AC-2: «Күн», «Ай» и «Жыл» начинаются с правильной даты по Бишкеку", async ({ page }) => {
    const { today, at } = bishkekNightClock();
    await page.clock.setFixedTime(at);
    await loginAs(page, ROLE);
    await page.goto("/monitoring");

    const from = page.getByLabel(tr("monitoring.range_from"));
    const to = page.getByLabel(tr("monitoring.range_to"));
    const preset = (key: string) => page.getByRole("button", { name: tr(key), exact: true }).click();

    await preset("monitoring.range_day");
    await expect(from).toHaveValue(today);
    await expect(to).toHaveValue(today);

    await preset("monitoring.range_month");
    await expect(from).toHaveValue(`${today.slice(0, 7)}-01`);
    await expect(to).toHaveValue(today);

    await preset("monitoring.range_year");
    await expect(from).toHaveValue(`${today.slice(0, 4)}-01-01`);
    await expect(to).toHaveValue(today);
  });
});
