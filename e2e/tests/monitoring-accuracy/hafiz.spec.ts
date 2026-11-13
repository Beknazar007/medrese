// monitoring-accuracy — хафиз-учитель «Абдыкадыров Ислам»: интерфейс не меняется. Нет «Мониторинга»,
// нерабочих дней и отметок, сервер отвечает 403 (1.17, 2.29); хафиз-журнал открывается как раньше,
// в том числе в нерабочий день (2.30). Хафиз-урок с оценками хифза без посещаемости (2.21) — в rector.spec.ts:
// это экран ректора. Спека: specs/monitoring-accuracy.md. Данные — e2e/fixtures/seed.py.
// Идёт и на телефоне (проект mobile, Pixel 7), и на компьютере.
import { API_URL, expect, loginAs, test, tr } from "../../fixtures/app";
import { expectNoStaffScreens, expectStaffApiForbidden } from "./forbidden";
import { bishkekToday, expectNoPageScrollX, staffApi } from "./stand";

const ROLE = "hafiz" as const;

test.describe(`monitoring-accuracy — ${ROLE}`, () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ROLE);
  });

  test("AC-1.17, AC-2.29: хафиз-учитель не видит «Мониторинг» и «Иш эмес күндөр», адреса уводят на /schedule", async ({ page, isMobile }) => {
    await expectNoStaffScreens(page, isMobile);
  });

  test("AC-1.17, AC-2.29: адреса мониторинга, главной, нерабочих дней, порога и отметок отвечают 403", async ({ page }) => {
    await expectStaffApiForbidden(page);
  });

  test("AC-2.30: в нерабочий день хафиз-журнал открывает урок как раньше", async ({ page, request, isMobile }) => {
    const rector = await staffApi(request);
    const today = bishkekToday();
    const made = await request.post(`${API_URL}/non-working-days`, {
      headers: rector.headers,
      data: { name: "Бүгүн майрам (e2e, хафиз)", start_date: today, end_date: today },
    });
    expect(made.status()).toBe(201);
    const id = (await made.json()).id as number;
    try {
      if (isMobile) await page.getByRole("button", { name: tr("nav.menu") }).click();
      await page.getByRole("link", { name: tr("nav.hifz_journal") }).click();
      await expect(page).toHaveURL(/\/hifz-journal$/);
      await expect(page.getByRole("tab", { name: tr("hifz.tab_lesson"), exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: tr("journal.mark_all_present") })).toBeVisible();
      await expect(page.getByText("Осмонов Абдулла", { exact: true }).first()).toBeVisible();
      if (isMobile) await expectNoPageScrollX(page);
    } finally {
      expect((await request.delete(`${API_URL}/non-working-days/${id}`, { headers: rector.headers })).status()).toBe(204);
    }
  });
});
