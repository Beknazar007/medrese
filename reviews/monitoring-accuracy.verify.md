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
