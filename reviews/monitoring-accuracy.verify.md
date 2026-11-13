# Проверка: monitoring-accuracy

## developer · попытка 1 — 2026-11-13 — ПОДТВЕРЖДЕНО
Перезапущено: pytest -q — 198 passed (110 с) · oxlint — 0 ошибок, 2 предупреждения (AuthContext.tsx, ConfirmContext.tsx — старые) · npm run build — ok · alembic upgrade head → downgrade -1 → upgrade head → check на временной базе `medrese_verify_ma` в docker-контейнере db (порт 55432), база удалена · e2e — не перезапускал, проверит qa

| Утверждение агента / пункт списка | Что увидел | Итог |
|---|---|---|
| Ветка `feature/monitoring-accuracy`, 13 коммитов main..HEAD, дерево чистое | `git branch --show-current` = feature/monitoring-accuracy; `git log main..HEAD` — 13 коммитов 43403fc … 5298f57; `git status --short` пусто | ✓ |
| Шаг 1 плана: `department_scope`, 404 на семестр, тесты прав | `core/deps.py::department_scope`; `/monitoring/teachers`, `/sessions`, оба `/dashboard/*-summary` через него + `get_semester_or_404`; `test_monitoring_api.py` | ✓ |
| Шаг 2: `now_bishkek`, `_occurrences`, процент, сортировка, обрезка семестром, N+1 | `services/monitoring.py` (`BISHKEK_TZ`, `now_bishkek`, `selectinload` на time_slot/assignment); `test_monitoring_rules.py` (1.1–1.14, `test_monitoring_does_not_n_plus_1`); `test_monitoring.py`, `test_hifz.py`, `test_teacher_replacement.py` переведены на `now=` | ✓ |
| Шаг 3: схемы и `response_model` | `schemas/monitoring.py`; `response_model` у всех четырёх GET и PUT; `test_responses_carry_percent_status_and_lowest_percent`, `test_endpoint_uses_bishkek_now` | ✓ |
| Шаг 4: фронтенд шага 1 | `types.ts`, `lib/monitoring.ts` (`percentColor`, `periodOutsideSemester`), `TeacherMonitoringPage.tsx`, `DashboardPage.tsx` | ✓ |
| Шаг 5: модели и миграция | `models/{non_working_day,lesson_mark,app_settings}.py`, `LessonMarkKind` в `enums.py`, `models/__init__.py`; миграция fbec5af838f4 (down_revision 3b9e6d1f2a40), вставляет строку (1, 15), downgrade удаляет enum | ✓ |
| Шаг 6: `/settings`, порог | `services/settings.py`, `api/v1/settings.py`; `test_settings.py` | ✓ |
| Шаг 7: `/non-working-days` | `api/v1/non_working_days.py`, `schemas/non_working_day.py`; `test_non_working_days.py` (в т. ч. открытие урока в нерабочий день — 2.30) | ✓ |
| Шаг 8: отметки | PUT/DELETE `/monitoring/lesson-marks`, удаление отметок в `schedule.py`; `test_lesson_marks.py` | ✓ |
| Шаг 9: флаги внимания | `no_student_marks`, `early_finish`, хафиз; тесты 2.17–2.21 в `test_monitoring_rules.py` | ✓ |
| Шаг 10: фронтенд шага 2 | `EntityCrudPage.tsx`, `NonWorkingDaysPage.tsx`, маршрут `RoleRoute roles={["RECTOR"]}`, пункт меню только у RECTOR, `LateThresholdCard.tsx` на `TimeSlotsPage`, `LessonMarkDialog.tsx` (fullScreen на телефоне, useConfirm, invalidate `monitoring` и `dashboard-teacher-monitoring`) | ✓ |
| Шаг 11: `e2e/fixtures/seed.py` | уроки пары 1 закрываются в 23:59, остальные как раньше | ✓ |
| Отклонения: `DEFAULT_LATE_THRESHOLD` в `services/settings.py`; `SessionStatus` в схемах; `StatTile.tsx` (тон `bad` из `TONE_INK`); `lib/errors.ts` | всё так; `LATE_THRESHOLD_MINUTES` больше нигде нет; `StatTile` и `errors.ts` — единственные файлы вне плана, оба объяснены | ✓ |
| Коды ошибок PUT: 409 lesson_opened/lesson_not_ended/outside_semester/non_working_day, 422 wrong_weekday | `api/v1/monitoring.py`: `WrongWeekday` → 422, `MarkTargetError` → 409 с кодом в `detail`; коды переведены в `lib/errors.ts` | ✓ |
| Лишние файлы, секреты, отладка | в диффе нет `.env`, ключей, дампов; нет `print`, `console.log`, `debugger` | ✓ |
| pytest — 198 passed | 198 passed | ✓ |
| lint — 0 ошибок (2 старых предупреждения), build ok | так и есть | ✓ |
| Права каждой роли с 403 | мониторинг: декан чужого отделения (журнал), декан без отделения, учитель и хафиз-учитель — 403 на 4 адреса; отметки: декан чужого отделения на PUT и DELETE, декан без отделения, учителя; урок, который до замены вёл учитель чужого отделения; `/non-working-days`: декан — только GET, учитель — 403 на всё; `/settings`: декан — только GET, учитель — 403 | ✓ |
| i18n: 557 ключей в каждом, расхождений 0 | сравнил скриптом: ky 557, ru 557, en 557, расхождений нет; `monitoring.col_score` и `dashboard.top_missed_title` удалены | ✓ |
| `toISOString()`, hex, сырой SQL | в добавленных строках нет; единственный `sa.text('now()')` — `server_default` в миграции, это не сырой запрос | ✓ |
| Миграция: upgrade → downgrade -1 → upgrade, alembic check | прошло; `alembic check` — «No new upgrade operations detected»; в `app_settings` одна строка (1, 15) | ✓ |
| e2e: 167 passed, 33 skipped | не перезапускал — проверит qa | не удалось проверить (не блокирует, по указанию) |
| Итерация > 1: замечания ревью закрыты | первая сдача, ревью ещё не было | — |

Расхождения в работе: нет
Поправки к отчёту: нет

## qa · попытка 1 — 2026-11-13 — ПОДТВЕРЖДЕНО
Перезапущено: `cd e2e && npx playwright test tests/monitoring-accuracy` — 32 passed, 1 failed, 15 skipped (2,9 мин) · воспроизведение бага 1 — временный pytest во scratchpad (фикстура `w` из `tests/test_lesson_marks.py`, SQLite) · весь e2e-набор не перезапускал (по указанию)

| Утверждение агента / пункт списка | Что увидел | Итог |
|---|---|---|
| 24 теста (rector 13, dean 5, teacher 3, hafiz 3), 2 проекта = 48 запусков | `test("…")`: rector 13, dean 5, teacher 3, hafiz 3; проекты `mobile` (Pixel 7) и `desktop`; 32+1+15 = 48 | ✓ |
| Все AC 1.x/2.x покрыты, кроме 1.2, 1.9, 1.14, 2.15 (в pytest) | В спеке 1.1–1.17, 2.1–2.30; в названиях тестов есть все, кроме 1.2, 1.9, 1.14, 2.15. Названные pytest-тесты существуют: `test_ended_pair_counts_as_missed`, `test_now_is_bishkek_not_utc`, `test_student_attendance_summary_clamped_to_semester_and_now` (test_monitoring_rules.py), `test_mark_follows_teacher_responsible_on_that_date` (test_lesson_marks.py) | ✓ |
| AC-2.24 ✗ из-за бага 1 | Упал `[desktop] dean.spec.ts:58 AC-2.24` на `expect(mark).toHaveCount(0)` (диалог не закрылся после «Сактоо»); в логе WebServer — `TypeError: Unable to apply constraint 'max_length' to supplied value None` | ✓ (причина та же) |
| Прогон фичи: 32 passed, 1 failed, 15 skipped | 32 passed, 1 failed, 15 skipped | ✓ |
| Весь набор: 199 passed, 1 failed, 48 skipped | не перезапускал (по указанию) | не удалось проверить (не блокирует) |
| Баг 1: PUT `/monitoring/lesson-marks` с `comment: null` или `""` → 500; без поля → 200 | Воспроизвёл: без поля → 200; `"ok"` → 200; `null` → TypeError (500); `""` → TypeError; **`"   "` (только пробелы) → тоже TypeError**; прямое `LessonMarkUpsert(comment=None)` — TypeError. Причина: `Field(max_length=500)` в `Annotated[str \| None, BeforeValidator(_blank_to_none), …]` (`backend/app/schemas/monitoring.py:60`) применяется ко всему значению, включая `None` | ✓ |
| `LessonMarkDialog` шлёт `comment: null` при пустом поле | `frontend/src/components/LessonMarkDialog.tsx:57` — `comment: comment.trim() \|\| null` | ✓ |
| pytest-помощник `_put` не передаёт `comment=None` | `tests/test_lesson_marks.py:98–102` — поле добавляется только при `comment is not None` | ✓ |
| Изменения qa только в `e2e/` | коммит e4d2765: `e2e/fixtures/seed.py` и `e2e/tests/monitoring-accuracy/*`; незакоммичено только `pipeline/`, `reviews/` | ✓ |
| `expect` в каждом тесте; нет `test.only`/`test.fixme`/безусловного `test.skip`; `waitForTimeout` | `test.skip` только по `isMobile` с причиной (rector.spec.ts:59, 486; dean.spec.ts:36); `only`, `fixme`, `waitForTimeout` нет | ✓ |
| Запреты: меню, прямой URL, 403 | `forbidden.ts::expectNoStaffScreens` (меню + редирект на /schedule) для учителя и хафиза; декан — пункты «Иш эмес күндөр», «Сабак убактылары», прямой адрес, 403 на изменения; 16 проверок 403 в тестах | ✓ |
| Учитель и хафиз-учитель идут в `mobile` | teacher/hafiz без skip, на mobile прошли | ✓ |
| Нет адресов прода | только `localhost`/`127.0.0.1` из `playwright.config.ts` | ✓ |
| Самопроверка qa — все ✓ | совпадает с моей проверкой, кроме дополнения про `"   "` | ✓ |

Расхождения в работе: нет (работа qa верна; баг 1 — в коде приложения, передаётся developer)
Поправки к отчёту: 1) было «comment null или "" → 500» → на деле также строка из одних пробелов `"   "` → 500 (тот же `_blank_to_none` превращает её в `None`)

Для developer (баг 1): в `LessonMarkUpsert.comment` ограничение длины должно применяться только к строке (например, `Annotated[str, Field(max_length=500)] | None` с `BeforeValidator` снаружи); добавить pytest на PUT с `comment: null`, `""` и `"   "` → 200 и `comment: null` в ответе.

## developer · попытка 1 (исправления перед ревью итерации 2) — 2026-11-13 — ПОДТВЕРЖДЕНО
Перезапущено: pytest -q — 202 passed (115 с) · oxlint — 0 ошибок, 2 старых предупреждения (AuthContext.tsx, ConfirmContext.tsx) · npm run build — ok · `npx playwright test tests/monitoring-accuracy` — 33 passed, 15 skipped, 0 failed (2,7 мин; повторный прогон для свежего `playwright-report/` — тоже зелёный) · проверка «падает на старом коде»: файлы из e4d2765 временно возвращались через `git checkout e4d2765 -- <файл>` и восстанавливались `git checkout HEAD -- <файл>`, в конце `git status` чистый · миграций нет

| Утверждение агента / пункт списка | Что увидел | Итог |
|---|---|---|
| Ветка `feature/monitoring-accuracy`, дерево чистое, коммиты 4a5e05c, 50e440a, 931a22b, 1e34a67 | так и есть; дифф e4d2765..HEAD: `non_working_days.py`, `schemas/monitoring.py`, `test_lesson_marks.py`, `test_non_working_days.py`, `LateThresholdCard.tsx`, `rector.spec.ts`, `pipeline/`, `reviews/` | ✓ |
| №1: `comment` null / `""` / `"   "` → 200 и `null` в ответе и в базе | `schemas/monitoring.py:61` — `Annotated[Annotated[str, Field(max_length=500)] \| None, BeforeValidator(_blank_to_none)]`; `test_empty_comment_is_saved_as_null[None, "", "   "]` проверяет ответ и `mark.comment` в базе | ✓ |
| №1: 501 символ → 422 | `test_too_long_comment_is_422` проходит | ✓ |
| №1: `_put` реально шлёт null (маркер `_OMIT`) | `_OMIT = object()`, поле пропускается только при `_OMIT`; `comment=None` кладёт `null` в тело | ✓ |
| №1: в схемах `non_working_day` и `settings` той же ошибки нет | `non_working_day.py`: `Name = Annotated[str, StringConstraints(max_length=255)…]`, в `Update` — `Name \| None`, ограничение на ветке str; дат с ограничениями нет | ✓ |
| №2: PATCH с `start_date: null` / `end_date: null` → 422, даты не меняются | `non_working_days.py:55-57`; `test_invalid_update_is_422` проверяет оба кода и что даты остались 2027-03-21 / 2027-03-22. Снятая проверка `if value is not None` в цикле безопасна: явный null теперь отсекается для всех трёх полей `NonWorkingDayUpdate` | ✓ |
| №3: убран `key` у `ThresholdForm`, e2e AC-2.22 ждёт «Сакталды» после перезагрузки настроек | `LateThresholdCard.tsx:77` без `key`; `rector.spec.ts:44-46` — `networkidle` и `alert` «Сакталды» | ✓ |
| Новые тесты падают на старом коде | старая схема: `test_empty_comment_is_saved_as_null` — 3 failed (`TypeError … max_length … None`); старый роутер: `test_invalid_update_is_422` — `assert 200 == 422` на `start_date: None`; старый `LateThresholdCard.tsx`: AC-2.22 [desktop] — failed на `getByRole('alert').filter({hasText: 'Сакталды'})`, element not found. `test_too_long_comment_is_422` проходит и на старом коде — это страховка, ошибку он и не должен был ловить | ✓ (для 501 — ✗ отчёт, см. ниже) |
| pytest — 202 passed | 202 passed | ✓ |
| lint — 0 ошибок, build ok | так и есть | ✓ |
| e2e tests/monitoring-accuracy — 33 passed, 0 failed | 33 passed, 15 skipped, 0 failed; AC-2.24 (dean, desktop) прошёл | ✓ (пропущенные не названы — ✗ отчёт) |
| Тест на каждое изменение бэкенда, права ролей | оба изменения бэкенда покрыты; новых адресов нет, права не менялись | ✓ |
| i18n | новых ключей нет | ✓ |
| `toISOString()`, hex, сырой SQL, отладка (`print`, `console.log`, `debugger`), секреты | в добавленных строках нет | ✓ |
| Миграция | в этой итерации нет | — |
| Итерация > 1: замечания ревью закрыты | Ревью итерации 1 — ОДОБРЕНО, только мелочи. Закрыта №2 (null-даты). №1 (отделение при межотделенческой замене), №3 (импорт хелпера между роутерами), №4, №5 не трогались. Ревьюер разрешил вынести их в отдельные задачи (№4, №5 — «ничего не делать сейчас»), и developer их не заявлял как сделанные. Баг qa (AC-2.24) закрыт | ✓ |

Расхождения в работе: нет
Поправки к отчёту: 1) было «новые тесты падают на старом коде» → на деле падают `test_empty_comment_is_saved_as_null` (3 варианта), `test_invalid_update_is_422` и e2e AC-2.22, а `test_too_long_comment_is_422` проходит и на старом коде (страховка от регрессии) · 2) было «e2e 33 passed, 0 failed» → полностью: 33 passed, 15 skipped (skip по `isMobile`, как у qa), 0 failed

Для reviewer (итерация 2): замечания 1 и 3 из итерации 1 остаются открытыми. Решить, оставлять ли их отдельной задачей.

## qa · попытка 1 (повторный прогон после исправлений) — 2026-11-13 — ПОДТВЕРЖДЕНО
Перезапущено: `cd e2e && npx playwright test tests/monitoring-accuracy` на af9ca2c — 33 passed, 15 skipped, 0 failed (2,8 мин) · pytest четырёх тестов, на которые qa сослался вместо e2e, — 4 passed · весь e2e-набор не перезапускал (прогонит CI на PR)

| Утверждение агента / пункт списка | Что увидел | Итог |
|---|---|---|
| 24 теста (rector 13, dean 5, teacher 3, hafiz 3) × 2 проекта = 48 | `test(` в файлах: 13 / 5 / 3 / 3; в прогоне 48 строк | ✓ |
| Все AC 1.1–1.17, 2.1–2.30 в названиях тестов, кроме 1.2, 1.9, 1.14, 2.15 | в спеке 47 критериев; в названиях `test("AC-…")` — 43, разница ровно 1.2, 1.9, 1.14, 2.15; лишних номеров нет | ✓ |
| 1.2, 1.9, 1.14, 2.15 покрыты pytest | `test_ended_pair_counts_as_missed`, `test_now_is_bishkek_not_utc`, `test_student_attendance_summary_clamped_to_semester_and_now` (test_monitoring_rules.py), `test_mark_follows_teacher_responsible_on_that_date` (test_lesson_marks.py) есть и проходят | ✓ |
| tests/monitoring-accuracy — 33 passed, 0 failed, 15 skipped | 33 passed, 15 skipped, 0 failed. Пропуски: mobile — dean 2 и rector 10 (блок «компьютер»), desktop — rector 3 (блок «телефон»), все по `isMobile` с причиной | ✓ |
| Весь набор — 200 passed, 0 failed, 48 skipped | не перезапускал (по заданию; проверит CI) | не удалось проверить: не запускался |
| Мелочь ревью №7: networkidle заменён на ожидание PATCH и GET /settings со статусом 200 | дифф af9ca2c: `waitForResponse` PATCH и GET `/settings`, оба `status 200` и `late_threshold_minutes`, затем «Сакталды»; `networkidle` удалён. GET-ожидание создаётся до клика — гонки нет. AC-2.22 [desktop] прошёл | ✓ |
| Нет test.only, test.fixme, безусловного skip, waitForTimeout, networkidle | grep: ни одного; три `test.skip(({ isMobile }) => …, "<причина>")` | ✓ |
| Каждый тест что-то утверждает | `expect` в файлах: rector 141, dean 39, teacher 11, hafiz 12; teacher/hafiz-тесты вызывают общие проверки из `forbidden.ts`, где есть `expect` | ✓ |
| Запреты: меню, прямой URL, API 403 | teacher, hafiz — `forbidden.ts` (нет пунктов меню, адреса уводят на /schedule или /hifz-journal, все адреса 403); dean — AC-1.16/2.25 (403 на журнал и отметки чужого отделения), AC-2.26, AC-2.27 (нет пункта меню, URL уводит, 403) | ✓ |
| Тесты учителя и хафиза идут в `mobile` | в teacher.spec.ts и hafiz.spec.ts skip нет; в прогоне есть [mobile] и [desktop] | ✓ |
| Изменения qa только в e2e/ (плюс pipeline/, reviews/) | e4d2765 — только e2e/ (включая `e2e/fixtures/seed.py`); af9ca2c — rector.spec.ts, pipeline/, reviews/; `git status` чистый | ✓ |
| Баги: нет; AC-2.24 у декана проходит | dean AC-2.24 [desktop] — ok; упавших тестов нет | ✓ |
| Адреса прода в тестах | `http(s)://`, onrender, pages.dev, neon — ни одного; стенд из playwright.config (localhost) | ✓ |
| Самопроверка (проход 1) | строка есть, все ✓ | ✓ |

Расхождения в работе: нет
Поправки к отчёту: нет (весь набор 200/0/48 — со слов qa, не перепроверен; подтвердит CI на PR)
