import { expect, test as base, type Page } from "@playwright/test";
import ky from "../../frontend/src/i18n/locales/ky.json" with { type: "json" };
import ru from "../../frontend/src/i18n/locales/ru.json" with { type: "json" };
import { PASSWORD, USERS, type Role } from "./users";

const LOCALES = { ky, ru } as const;
export type Lang = keyof typeof LOCALES;

/** Text of an i18n key, e.g. tr("login.submit") → «Кирүү». Locators use it so tests follow the real UI copy. */
export function tr(key: string, lang: Lang = "ky"): string {
  const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], LOCALES[lang]);
  if (typeof value !== "string") throw new Error(`No i18n text for "${key}" (${lang})`);
  return value;
}

/** Logs in through the login form, the way a person does. */
export async function loginAs(page: Page, role: Role, lang: Lang = "ky") {
  const user = USERS[role];
  await page.goto("/login");
  await page.getByLabel(tr("login.username", lang)).fill(user.username);
  await page.getByLabel(tr("login.password", lang)).fill(PASSWORD);
  await page.getByRole("button", { name: tr("login.submit", lang) }).click();
  await expect(page).toHaveURL(new RegExp(`${user.home}$`));
}

/** `test` with the interface language set before the app loads (the app reads it from localStorage). */
export const test = base.extend<{ lang: Lang }>({
  lang: ["ky", { option: true }],
  page: async ({ page, lang }, use) => {
    await page.addInitScript((l) => localStorage.setItem("i18nextLng", l), lang);
    await use(page);
  },
});

export { expect };
