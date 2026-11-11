// ux-fixes-2 — учитель «Мамытов Азамат»: кнопки посещаемости на «Менин классым» (B7), заметка без
// вопроса (B8, C10), завершение урока с вопросом (C9), ФИО в шапке и меню (B11).
// Спека: specs/ux-fixes-2.md. Данные — e2e/fixtures/seed.py (урок «Фикх», «Кары 1» — сегодня, пара на весь день).
// Урок никогда не завершается («Сабакты аяктоо» → только «Жокко чыгаруу»), иначе журнал закроется для следующих тестов.
import type { Page } from "@playwright/test";
import { API_URL, authHeader, expect, loginAs, test, tr, type Lang } from "../../fixtures/app";
import { EXTRA_USERS, USERS } from "../../fixtures/users";
import {
  CLASS_EXCUSED,
  CLASS_STUDENT,
  CLASS_STUDENT_2,
  LANGS,
  LETTERS,
  SOLID_RGB,
  STATUSES,
  apiLogin,
  bishkekToday,
  expectNoPageScrollX,
  measureButtons,
  question,
  statusButton,
  statusLabel,
  studentBlock,
  switchLanguage,
  track,
  uniq,
} from "./stand";

const ROLE = "teacher" as const;
const ATTENDANCE_SAVE = /\/journal\/sessions\/\d+\/(attendance|grades)$/;

async function openMyClass(page: Page, lang: Lang = "ky") {
  await loginAs(page, ROLE, lang);
  await page.goto("/my-class");
  await expect(page.getByRole("button", { name: tr("journal.mark_all_present", lang) })).toBeVisible();
}

/** Makes sure the status is selected (the shared stand may already have it from the other project). */
async function ensureSelected(page: Page, isMobile: boolean, name: string, status: (typeof STATUSES)[number], lang: Lang = "ky") {
  const button = statusButton(studentBlock(page, isMobile, name, lang), status, lang);
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

async function waitSaved(page: Page, lang: Lang = "ky") {
  await expect(page.getByText(tr("hifz.autosave_hint", lang), { exact: true })).toBeVisible({ timeout: 10_000 });
}

test.describe(`ux-fixes-2 — ${ROLE}`, () => {
  for (const lang of LANGS) {
    test.describe(`язык ${lang}`, () => {
      test.use({ lang });

      test(`AC-1, AC-5: буквы «${LETTERS[lang].join(" ")}» и полные слова у кнопок (${lang})`, async ({ page, isMobile }) => {
        await openMyClass(page, lang);
        for (const name of [CLASS_STUDENT, CLASS_STUDENT_2]) {
          const block = studentBlock(page, isMobile, name, lang);
          const group = block.getByRole("group");
          await expect(group.getByRole("button")).toHaveText(LETTERS[lang]);
          const labels = await group.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
          expect(labels).toEqual(STATUSES.map((s) => statusLabel(s, lang)));
        }
        if (!isMobile) {
          // On a computer the same word shows up as a hint on hover.
          await statusButton(studentBlock(page, false, CLASS_STUDENT, lang), "late", lang).hover();
          await expect(page.getByRole("tooltip", { name: statusLabel("late", lang), exact: true })).toBeVisible();
        }
      });

      test(`AC-6: у каждого счётчика над списком стоит буква (${lang})`, async ({ page }) => {
        await openMyClass(page, lang);
        const legend = page.getByTestId("attendance-legend");
        for (const [i, status] of STATUSES.entries()) {
          const prefix = tr("journal.attendance_legend", lang)
            .replace("{{letter}}", LETTERS[lang][i])
            .replace("{{label}}", statusLabel(status, lang));
          await expect(legend).toContainText(new RegExp(`${prefix}: \\d+`));
        }
      });
    });
  }

  test("AC-3: в каждом языке четыре буквы разные и непустые", async () => {
    for (const lang of LANGS) {
      const letters = STATUSES.map((s) => tr(`journal.attendance_short_${s}`, lang));
      expect(letters).toEqual(LETTERS[lang]);
      expect(new Set(letters).size).toBe(4);
      for (const l of letters) expect(l.trim()).not.toBe("");
    }
  });

  test("AC-2: смена языка меняет буквы сразу, без перезагрузки и без повторного сохранения", async ({ page, isMobile }) => {
    await openMyClass(page);
    await ensureSelected(page, isMobile, CLASS_STUDENT, "present");
    await waitSaved(page);
    await page.evaluate(() => ((window as unknown as { __noReload: number }).__noReload = 1));
    const saves = track(page, "PUT", ATTENDANCE_SAVE);
    const posts = track(page, "POST", /\/journal\//);

    for (const lang of ["ru", "en", "ky"] as const) {
      await switchLanguage(page, isMobile, lang);
      const block = studentBlock(page, isMobile, CLASS_STUDENT, lang);
      await expect(block.getByRole("group").getByRole("button")).toHaveText(LETTERS[lang]);
      await expect(statusButton(block, "present", lang)).toHaveAttribute("aria-pressed", "true");
    }
    await page.waitForTimeout(1_500); // longer than the 0.8 s autosave pause
    expect(saves).toEqual([]);
    expect(posts).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __noReload?: number }).__noReload)).toBe(1);
  });

  test.describe("телефон 390×844", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test.skip(({ isMobile }) => !isMobile, "размер кнопок на телефоне");

    test("AC-7: кнопки не меньше 44×44, буква ≥ 16 px, всё видно без горизонтальной прокрутки", async ({ page }) => {
      await openMyClass(page);
      const cards = page.getByTestId("attendance-card");
      expect(await cards.count()).toBeGreaterThanOrEqual(8);
      for (let i = 0; i < (await cards.count()); i++) {
        await cards.nth(i).scrollIntoViewIfNeeded();
        for (const b of await measureButtons(cards.nth(i))) {
          expect(b.width, `${b.status} width`).toBeGreaterThanOrEqual(44);
          expect(b.height, `${b.status} height`).toBeGreaterThanOrEqual(44);
          expect(b.fontSize, `${b.status} font`).toBeGreaterThanOrEqual(16);
          expect(b.right, `${b.status} right edge`).toBeLessThanOrEqual(390);
        }
      }
      await expectNoPageScrollX(page);
      // No table that could scroll on its own either: phones get cards (plan, TeacherClassPage).
      await expect(page.getByRole("table")).toHaveCount(0);
    });

    test("AC-19, AC-22: заметка добавляется одним нажатием, двойное нажатие — одна заметка", async ({ page }) => {
      await openMyClass(page);
      const posts = track(page, "POST", /\/students\/\d+\/notes$/);
      const card = studentBlock(page, true, CLASS_STUDENT_2);
      await card.getByRole("button", { name: tr("students.notes_title") }).click();
      const dialog = page.getByRole("dialog").filter({ hasText: tr("journal.notes_for").replace("{{name}}", CLASS_STUDENT_2) });
      await expect(dialog).toBeVisible();

      const first = `Бир басуу ${uniq()}`;
      await dialog.getByLabel(tr("journal.note_body")).fill(first);
      await dialog.getByRole("button", { name: tr("journal.note_add"), exact: true }).click();
      await expect(dialog.getByText(first, { exact: true })).toBeVisible();
      await expect(dialog.getByLabel(tr("journal.note_body"))).toHaveValue("");
      await expect(question(page)).toHaveCount(0);
      expect(posts).toHaveLength(1);

      const second = `Эки басуу ${uniq()}`;
      await dialog.getByLabel(tr("journal.note_body")).fill(second);
      await dialog.getByRole("button", { name: tr("journal.note_add"), exact: true }).dblclick();
      await expect(dialog.getByText(second, { exact: true })).toHaveCount(1);
      await page.waitForTimeout(1_000);
      expect(posts).toHaveLength(2);
      await expect(dialog.getByText(second, { exact: true })).toHaveCount(1);
    });
  });

  test.describe("компьютер 1280×800", () => {
    test.use({ viewport: { width: 1280, height: 800 } });
    test.skip(({ isMobile }) => isMobile, "таблица — широкий экран");

    test("AC-8: кнопки не меньше 44×44, таблица без горизонтальной прокрутки", async ({ page }) => {
      await openMyClass(page);
      for (const name of [CLASS_STUDENT, CLASS_EXCUSED.name]) {
        for (const b of await measureButtons(studentBlock(page, false, name))) {
          expect(b.width, `${b.status} width`).toBeGreaterThanOrEqual(44);
          expect(b.height, `${b.status} height`).toBeGreaterThanOrEqual(44);
        }
      }
      const { scroll, client } = await page
        .getByRole("table")
        .evaluate((t) => ({ scroll: t.parentElement!.scrollWidth, client: t.parentElement!.clientWidth }));
      expect(scroll).toBeLessThanOrEqual(client);
      await expectNoPageScrollX(page);
    });
  });

  test("AC-9: выбранная кнопка — цвет STATUS_SOLID и белая буква в светлой и ночной теме", async ({ page, isMobile }) => {
    await openMyClass(page);
    await ensureSelected(page, isMobile, CLASS_STUDENT, "present");
    for (const mode of ["light", "dark"] as const) {
      if (mode === "dark") await page.getByRole("button", { name: tr("nav.dark_mode") }).click();
      const block = studentBlock(page, isMobile, CLASS_STUDENT);
      const present = statusButton(block, "present");
      await expect(present).toHaveCSS("background-color", SOLID_RGB.present);
      await expect(present).toHaveCSS("color", "rgb(255, 255, 255)");
      const excused = statusButton(studentBlock(page, isMobile, CLASS_EXCUSED.name), "excused");
      await expect(excused).toHaveCSS("background-color", SOLID_RGB.excused);
      await expect(excused).toHaveCSS("color", "rgb(255, 255, 255)");
    }
    await expect(page.getByRole("button", { name: tr("nav.light_mode") })).toBeVisible();
  });

  test("AC-10: у освобождённого деканатом кнопки заблокированы, выбрана «С», видна причина", async ({ page, isMobile }) => {
    await openMyClass(page);
    const block = studentBlock(page, isMobile, CLASS_EXCUSED.name);
    for (const status of STATUSES) await expect(statusButton(block, status)).toBeDisabled();
    await expect(statusButton(block, "excused")).toHaveAttribute("aria-pressed", "true");
    await expect(statusButton(block, "excused")).toHaveText(LETTERS.ky[3]);
    await expect(block.getByText(`${tr("journal.excused_by_deanery")}: ${CLASS_EXCUSED.reason}`)).toBeVisible();
  });

  test("AC-11, AC-24: нажатие ставит и снимает отметку, «Баарын келди» работает, окон вопроса нет", async ({ page, isMobile }) => {
    await openMyClass(page);
    const saves = track(page, "PUT", ATTENDANCE_SAVE);
    const block = studentBlock(page, isMobile, CLASS_STUDENT_2);
    const late = statusButton(block, "late");
    const startPressed = (await late.getAttribute("aria-pressed")) === "true";
    if (startPressed) await late.click(); // start from "not late"
    await expect(late).toHaveAttribute("aria-pressed", "false");

    await late.click();
    await expect(late).toHaveAttribute("aria-pressed", "true");
    for (const other of ["present", "absent", "excused"] as const) {
      await expect(statusButton(block, other)).toHaveAttribute("aria-pressed", "false");
    }
    // Autosave: "Сакталууда…" while waiting, then the usual hint — and no question at all.
    await expect(page.getByText(tr("hifz.autosave_saving"), { exact: true })).toBeVisible();
    await waitSaved(page);
    expect(saves.length).toBeGreaterThan(0);

    await late.click();
    await expect(late).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("attendance-legend")).toContainText(tr("journal.unset"));

    await page.getByRole("button", { name: tr("journal.mark_all_present") }).click();
    await expect(statusButton(block, "present")).toHaveAttribute("aria-pressed", "true");
    await expect(statusButton(studentBlock(page, isMobile, CLASS_EXCUSED.name), "excused")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("attendance-legend")).not.toContainText(tr("journal.unset"));
    await waitSaved(page);
    await expect(question(page)).toHaveCount(0);
  });

  test("AC-23 (C9): «Сабакты аяктоо» спрашивает, «Жокко чыгаруу» ничего не отправляет", async ({ page }) => {
    await openMyClass(page);
    const checkOuts = track(page, "PUT", /\/check-out$/);
    await page.getByRole("button", { name: tr("journal.check_out"), exact: true }).click();
    const q = question(page);
    await expect(q).toContainText(tr("journal.checked_out_confirm"));
    await q.getByRole("button", { name: tr("common.cancel"), exact: true }).click();
    await expect(q).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(checkOuts).toEqual([]);
    await expect(page.getByRole("button", { name: tr("journal.check_out"), exact: true })).toBeVisible();
  });

  test("AC-12: кнопки посещаемости только на своём уроке — в чужой журнал сервер не пускает", async ({ page }) => {
    await openMyClass(page);
    const headers = await authHeader(page);
    // Another teacher's lesson (teacher2 «Араб тили», «Кары 1»): the server refuses to open its journal.
    const rh = await apiLogin(page.request, "rector");
    const entries = (await (await page.request.get(`${API_URL}/schedule`, { headers: rh })).json()) as { id: number; teacher_id: number }[];
    const mine = (await (await page.request.get(`${API_URL}/teachers/me`, { headers })).json()) as { id: number };
    const foreign = entries.find((e) => e.teacher_id !== mine.id)!;
    const res = await page.request.post(`${API_URL}/journal/sessions`, {
      headers,
      data: { schedule_entry_id: foreign.id, date: bishkekToday() },
    });
    expect(res.status()).toBe(403);
  });

  test("AC-25, AC-31: нет справочников и «Админ каттоолор», прямой адрес уводит, сервер — 403", async ({ page, isMobile }) => {
    await loginAs(page, ROLE);
    if (isMobile) await page.getByRole("button", { name: tr("nav.menu") }).click();
    await expect(page.getByRole("link", { name: tr("nav.schedule") })).toBeVisible();
    for (const key of ["nav.admin_accounts", "nav.rooms", "nav.subjects", "nav.groups", "nav.teachers"]) {
      await expect(page.getByRole("link", { name: tr(key) })).toHaveCount(0);
    }
    if (isMobile) await page.keyboard.press("Escape");
    for (const path of ["/users", "/rooms"]) {
      await page.goto(path);
      await expect(page).not.toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("button", { name: tr("common.add"), exact: true })).toHaveCount(0);
    }
    const headers = await authHeader(page);
    expect((await page.request.get(`${API_URL}/users`, { headers })).status()).toBe(403);
    expect((await page.request.post(`${API_URL}/rooms`, { headers, data: { name: `T${uniq()}`, building: "A" } })).status()).toBe(403);
    expect((await page.request.post(`${API_URL}/subjects`, { headers, data: { name: "x", code: `T${uniq()}`, department_id: 1 } })).status()).toBe(403);
  });

  test("AC-38, AC-45: /auth/me отдаёт ФИО только своё, без токена — 401", async ({ page }) => {
    await loginAs(page, ROLE);
    const me = await page.request.get(`${API_URL}/auth/me`, { headers: await authHeader(page) });
    expect(me.status()).toBe(200);
    const body = await me.json();
    expect(body.full_name).toBe(USERS.teacher.fullName);
    expect(body.username).toBe(USERS.teacher.username);
    expect(JSON.stringify(body)).not.toContain(USERS.hafiz.fullName);
    expect((await page.request.get(`${API_URL}/auth/me`)).status()).toBe(401);
    expect((await page.request.get(`${API_URL}/auth/me`, { headers: { Authorization: "Bearer garbage" } })).status()).toBe(401);
  });

  test("AC-39, AC-40: в меню (телефон) и в шапке (компьютер) — ФИО и «Мугалим», логина нет", async ({ page, isMobile }) => {
    await loginAs(page, ROLE);
    const name = page.getByText(USERS.teacher.fullName, { exact: true });
    if (isMobile) {
      await page.getByRole("button", { name: tr("nav.menu") }).click();
      await expect(name).toBeVisible();
      const role = page.getByText(tr("users.role_teacher"), { exact: true });
      await expect(role).toBeVisible();
      const [n, r] = [await name.boundingBox(), await role.boundingBox()];
      expect(n!.y).toBeLessThan(r!.y); // name first, role under it
    } else {
      await expect(page.getByRole("banner")).toContainText(`${USERS.teacher.fullName} · ${tr("users.role_teacher")}`);
      await expect(page.getByRole("banner")).not.toContainText(`${USERS.teacher.username} ·`);
    }
    await expect(page.getByText(USERS.teacher.username, { exact: true })).toHaveCount(0);
  });
});

test.describe(`ux-fixes-2 — ${ROLE} — длинное ФИО`, () => {
  const LONG = EXTRA_USERS.long_name_teacher.fullName;

  test("AC-43: на телефоне 60 символов обрезаются многоточием в одну строку, меню не шире 230 px", async ({ page, isMobile }) => {
    test.skip(!isMobile, "меню — телефон");
    expect(LONG).toHaveLength(60);
    await loginAs(page, "long_name_teacher");
    await page.getByRole("button", { name: tr("nav.menu") }).click();
    const name = page.getByText(LONG, { exact: true });
    await expect(name).toBeVisible();
    await expect(name).toHaveAttribute("title", LONG);
    const m = await name.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
      height: el.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(el).lineHeight),
      ellipsis: getComputedStyle(el).textOverflow,
      drawer: el.closest(".MuiDrawer-paper")!.getBoundingClientRect().width,
    }));
    expect(m.scroll).toBeGreaterThan(m.client); // cut off
    expect(m.ellipsis).toBe("ellipsis");
    expect(m.height).toBeLessThan(m.lineHeight * 1.5); // one line
    expect(m.drawer).toBeLessThanOrEqual(230);
  });

  test.describe("компьютер 900 px", () => {
    test.use({ viewport: { width: 900, height: 800 } });

    test("AC-43: в шапке ФИО не выталкивает «Чыгуу» и смену темы за край экрана", async ({ page, isMobile }) => {
      test.skip(isMobile, "шапка — широкий экран");
      await loginAs(page, "long_name_teacher");
      const banner = page.getByRole("banner");
      await expect(banner.getByText(new RegExp(`^${LONG}`))).toBeVisible();
      for (const target of [
        banner.getByRole("button", { name: tr("nav.logout"), exact: true }),
        banner.getByRole("button", { name: tr("nav.dark_mode") }),
      ]) {
        await expect(target).toBeVisible();
        const box = (await target.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(900);
      }
      await expectNoPageScrollX(page);
    });
  });
});
