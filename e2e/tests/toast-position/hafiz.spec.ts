// toast-position — B12 (docs/user-guide/features.md): after «План кошуу» the «Сакталды» message used to sit
// over the full-screen dialog's bottom bar and cover «Жабуу» for seconds. Now messages appear at the top.
// Data: e2e/fixtures/seed.py; the plan the test creates it deletes itself through the API.
import { API_URL, authHeader, expect, loginAs, test, tr } from "../../fixtures/app";
import { HAFIZ_STUDENT, studentBlock, uniq } from "../ux-fixes-2/stand";

test.describe("toast-position — hafiz", () => {
  test("B12: «Сакталды» не закрывает «Жабуу» — окно закрывается сразу после сохранения", async ({ page, isMobile }) => {
    await loginAs(page, "hafiz");
    await page.goto("/hifz-journal");
    await expect(page.getByRole("button", { name: tr("journal.mark_all_present") })).toBeVisible();

    await studentBlock(page, isMobile, HAFIZ_STUDENT).getByRole("button", { name: tr("hifz.targets_button") }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: tr("hifz.targets_title").replace("{{name}}", HAFIZ_STUDENT) });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(tr("hifz.target_juz_from")).fill("3");
    await dialog.getByLabel(tr("hifz.target_note")).fill(`B12 ${uniq()}`);
    const created = page.waitForResponse((r) => r.request().method() === "POST" && /\/hifz\/targets$/.test(r.url()));
    await dialog.getByRole("button", { name: tr("hifz.target_add"), exact: true }).click();
    const planId = (await (await created).json()).id as number;

    const message = page.getByText(tr("hifz.saved"), { exact: true });
    await expect(message).toBeVisible();
    const close = dialog.getByRole("button", { name: tr("journal.close"), exact: true });
    const [m, c] = [await message.boundingBox(), await close.boundingBox()];
    expect(m && c).toBeTruthy();
    // The message and the button must not overlap anywhere.
    const overlap = m!.x < c!.x + c!.width && c!.x < m!.x + m!.width && m!.y < c!.y + c!.height && c!.y < m!.y + m!.height;
    expect(overlap).toBe(false);

    // A normal click (no force) while the message is still on screen: Playwright fails it if something covers the button.
    await close.click({ timeout: 1_000 });
    await expect(dialog).toBeHidden();

    const res = await page.request.delete(`${API_URL}/hifz/targets/${planId}`, { headers: await authHeader(page) });
    expect(res.ok()).toBe(true);
  });
});
