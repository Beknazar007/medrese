// What e2e/fixtures/seed.py put on the stand for ux-fixes (E2E_EXTRA_DATA=1) and small UI helpers
// shared by the role files. Names here must match seed.py.
import type { Locator, Page } from "@playwright/test";
import { expect, tr, type Lang } from "../../fixtures/app";

/** Weekdays seed.py uses for lessons other than today's: d1, d2, d3 (Mon–Sat, today skipped). */
export function standDays(): [number, number, number] {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bishkek", weekday: "short" }).format(new Date());
  const today = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday) + 1;
  const days = [1, 2, 3, 4, 5, 6].filter((d) => d !== today);
  return [days[0], days[1], days[2]];
}

/** A unique suffix, so records created by the mobile and desktop runs never collide. */
export function uniq(): string {
  return `${Date.now() % 1_000_000}`;
}

export function formDialog(page: Page, lang: Lang = "ky"): Locator {
  return page.getByRole("dialog").filter({ has: page.getByRole("button", { name: tr("common.save", lang), exact: true }) });
}

/** Picks an option in a form's autocomplete field. */
export async function pick(page: Page, dialog: Locator, label: string, option: string) {
  const box = dialog.getByRole("combobox", { name: label, exact: true });
  await box.click();
  await box.fill("");
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(box).toHaveValue(option);
}

/** Clicks "Save" in the form and answers "Yes" to "Save changes?"; returns the question's text. */
export async function saveAndConfirm(page: Page, lang: Lang = "ky"): Promise<string> {
  await formDialog(page, lang).getByRole("button", { name: tr("common.save", lang), exact: true }).click();
  const question = page.getByRole("dialog").filter({ hasText: tr("common.confirm_title", lang) });
  await expect(question).toBeVisible();
  const text = (await question.textContent()) ?? "";
  await question.getByRole("button", { name: tr("common.yes", lang), exact: true }).click();
  return text;
}

/** Fills and submits the change-password dialog. */
export async function changePassword(page: Page, current: string, next: string, confirm = next) {
  const dialog = page.getByRole("dialog").filter({ hasText: tr("password.dialog_title") });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(tr("password.current"), { exact: true }).fill(current);
  await dialog.getByLabel(tr("password.new_password"), { exact: true }).fill(next);
  await dialog.getByLabel(tr("password.confirm"), { exact: true }).fill(confirm);
  await dialog.getByRole("button", { name: tr("password.save"), exact: true }).click();
  return dialog;
}

/** The success message stays on screen at least 3 seconds (criterion 33). */
export async function expectPasswordChangedMessage(page: Page) {
  const message = page.getByText(tr("password.changed"), { exact: true });
  await expect(message).toBeVisible();
  await page.waitForTimeout(3_000);
  await expect(message).toBeVisible();
}
