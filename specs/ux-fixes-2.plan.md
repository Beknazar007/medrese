# План: Исправление недочётов, найденных при записи видео (B7–B11)
Спека: specs/ux-fixes-2.md · Ветка: feature/ux-fixes-2 (от feature/ux-fixes)

## Решение

Фича почти целиком фронтендовая; на сервере меняется только `GET /api/v1/auth/me`: у него появляется поле `full_name`. Ответ описывает новая схема `MeOut(UserOut)`, а `UserOut` не меняется: он же служит ответом `GET/POST /users`, и контракт `/users` трогать незачем. **B7:** буквы посещаемости переходят в i18n (`journal.attendance_short_*`), у каждой кнопки появляется `aria-label` с полным словом. Кнопки становятся 44×44. На телефоне (< 600 px) «Менин классым» переходит с таблицы на карточки, как уже сделано в хафиз-журнале. В широкой таблице хафиз-урока ячейка посещаемости и так занимает две строки (хифз и такрар), поэтому кнопки там стоят сеткой 2×2 и не добавляют ширины. **B8:** вызовы `confirm()` убираются точечно в 6 местах. В `EntityCrudPage` вопрос остаётся только при непустом `confirmMessage` (замена преподавателя). Защиту от двойного нажатия даёт общий хук `useSingleFlight` (ref-флаг): одного `disabled={isPending}` мало, потому что TanStack Query сообщает компоненту о `isPending` асинхронно. **B9:** `render` для колонки роли, без перевода выводится «—». **B10:** везде используется существующая `fmtDate` из `hifzUtils.ts`. Она разбирает строку без `Date`, поэтому часовой пояс устройства на дату не влияет. По решению 4 формат `27.10.2026` одинаков на всех трёх языках; вариант `5 Nov 2026` из критерия 33 отброшен. **B11:** в шапке и меню показывается `full_name ?? username`.

Что отброшено:
- поле `full_name` в `User` с миграцией: по спеке ФИО ректора и декана вне рамок;
- отдельный эндпоинт профиля: лишний запрос при каждом входе;
- `Intl.DateTimeFormat` для дат: зависит от часового пояса и в любом случае дал бы тот же вид для ky и ru;
- горизонтальная прокрутка таблицы «Менин классым» на телефоне: прямо нарушает критерий 7.

## Модель данных и миграции

Миграции нет. Таблицы и колонки не меняются. `full_name` вычисляется из уже существующих `teacher_profiles.full_name` через связь `User.teacher_profile`.

## API

| Метод и путь | Роли (require_role / доступ к кафедре) | Запрос | Ответ | Ошибки |
|---|---|---|---|---|
| `GET /api/v1/auth/me` (изменён) | Любой вошедший пользователь (`get_current_user`), только о себе. RECTOR, DEAN, TEACHER и TEACHER с хафиз-группой получают свои данные; чужие получить нельзя, потому что параметров нет и пользователь берётся из токена. Кафедра не проверяется. | — | `MeOut`: `id, username, email, role, is_active, must_change_password, headed_department_id` как раньше, плюс `full_name: str \| null`. **Источник по ролям:** TEACHER с профилем (включая хафиз-учителя) — `TeacherProfile.full_name`; TEACHER без профиля — `null`; RECTOR и DEAN — `null` (профиля у них нет, это аккаунты из `/users`). Формально правило одно: `current_user.teacher_profile.full_name if current_user.teacher_profile else None`, без проверки роли, как в критерии 38. | 401 без токена, с неверным токеном или у неактивного пользователя (как сейчас) |
| `GET /api/v1/users`, `POST /api/v1/users` (не меняются) | Только RECTOR; DEAN и TEACHER получают 403 (как сейчас) | — | `UserOut` без `full_name` | 403 |

Других новых или изменённых адресов нет. Права на справочники, расписание и хафиз (`POST/PATCH/DELETE`) не меняются: для TEACHER по-прежнему 403 (критерий 25).

## Изменения по файлам

### Бэкенд

| Файл | Что сделать |
|---|---|
| `backend/app/schemas/auth.py` | Добавить `class MeOut(UserOut): full_name: str \| None = None`. `UserOut` не трогать. |
| `backend/app/api/v1/auth.py` | `@router.get("/me", response_model=MeOut)`. В `me()` вернуть `MeOut(..., full_name=profile.full_name if (profile := current_user.teacher_profile) is not None else None)`. Одна ленивая загрузка `teacher_profile` на запрос — это не список, так что N+1 нет. Комментарий «почему»: `/users` использует `UserOut`, поэтому поле добавлено только сюда. |
| `backend/tests/test_auth_me.py` (новый) | Тесты ниже, в разделе «Тесты». |

### Фронтенд

| Файл | Что сделать |
|---|---|
| `frontend/src/api/types.ts` | В `CurrentUser` добавить `full_name: string \| null`. |
| `frontend/src/lib/attendance.ts` | Добавить `attendanceLabelKey(status)` → `journal.attendance_${lower}` и `attendanceLetterKey(status)` → `journal.attendance_short_${lower}`, чтобы ключи собирались в одном месте. |
| `frontend/src/components/AttendanceToggle.tsx` | Удалить `ATTENDANCE_SHORT`. Буква — `t(attendanceLetterKey(status))`. У `ToggleButton` поставить `aria-label={t(attendanceLabelKey(status))}`, а `Tooltip` с тем же текстом поставить с `describeChild`, чтобы доступное имя не дублировалось. Размеры: `minWidth: 44, minHeight: 44, fontSize: 16, fontWeight: 700`, убрать `size="small"`, `px:1.1`, `py:0.3`. Новый проп `layout?: "row" \| "grid"`, по умолчанию `row`. `grid` — `display: grid; gridTemplateColumns: repeat(2, 44px); gap: 0.5`, у `.MuiToggleButtonGroup-grouped` сброшены отрицательные отступы, у каждой кнопки своя рамка (`divider`) и `borderRadius: 1`. Порядок чтения остаётся К Ж / О С. Новый проп `fullWidth?: boolean` для карточек на телефоне: кнопки растягиваются через `flex: 1`, минимум 44. Цвет буквы на выбранной кнопке — `common.white` вместо `"#fff"` (критерии 9 и 47). Блокировка при освобождении и подпись «Деканат: …» остаются как есть. |
| `frontend/src/components/AttendanceLegend.tsx` (новый) | Общая строка счётчиков для двух журналов: для каждого статуса `t("journal.attendance_legend", { letter, label })`, затем `: <strong>{count}</strong>`. «Белгиленген жок» остаётся как сейчас, цветом `STATUS_INK.late`. Пропсы: `counts` (результат `countAttendance`). Показывается на всех ширинах. |
| `frontend/src/pages/teacher/TeacherClassPage.tsx` | (1) Строки 409–420: блок счётчиков заменить на `<AttendanceLegend counts={attendanceCounts} />`. (2) Строки 423–471: при `isMobile` (`useIsMobile`, < 600 px) вывести карточки (`Paper variant="outlined"`, оттенок строки `ATTENDANCE_ROW_TINT`): первая строка — ФИО (кликабельно, открывает профиль, `overflowWrap: anywhere`) и иконка комментария справа; ниже `<AttendanceToggle fullWidth …/>`; при `isExam` ещё ниже поле оценки на всю ширину. На ширине ≥ 600 px остаётся таблица, `AttendanceToggle` в `layout="row"`. (3) `NotesDialog`, строки 567 и 585–589: убрать `const confirm = useConfirm()` и вопрос; `handleAddNote` вызывает `run(() => createMutation.mutateAsync())` через `useSingleFlight`. Ошибку по-прежнему показывает `onError` мутации; `mutateAsync` обернуть в `.catch(() => {})`, чтобы не было необработанного отказа. |
| `frontend/src/pages/teacher/HifzJournalPage.tsx` | (1) Строки 483–494: заменить на `<AttendanceLegend …/>`. (2) Строка 517 (карточка на телефоне): `<AttendanceToggle fullWidth …/>`. (3) Строка 600 (таблица ≥ 600 px): `<AttendanceToggle layout="grid" …/>`. (4) `HifzTargetsDialog`: убрать `confirm()` из `handleSaveTarget` (строки 812–817), сохранение идёт через `useSingleFlight` и `mutateAsync`. Добавить проп `onSaved: (msg: string) => void` и вызывать `onSaved(t("hifz.saved"))` в `onSuccess` обеих мутаций (create и update). Строка 838: `{fmtDate(target.start_date)} — {fmtDate(target.end_date)}` вместо `→`. Удаление (строка 820) не трогать. (5) Строки 719–720: передать `onSaved={setSnackbar}` в `HifzTargetsDialog` и `HifzExamsDialog`. Snackbar уже держится 3000 мс; это ≥ 3 с, критерий 20 выполнен. |
| `frontend/src/components/hifz/HifzExamsDialog.tsx` | Убрать `confirm()` из `handleSaveExam` (строки 121–126), сохранять через `useSingleFlight`. Новый необязательный проп `onSaved?: (msg) => void`, вызывать `onSaved?.(t("hifz.saved"))` при успешном create или update. Строка 161: `{fmtDate(exam.date)} — {exam.title}`. Удаление (строка 129) оставить. |
| `frontend/src/components/hifz/HifzGradebook.tsx` | Строки 497–504: передать `onSaved={setSnackbar}` в `HifzExamsDialog`. Хафиз-учитель с `can_edit` сохраняет экзамен и отсюда; у ректора и декана `readOnly`, кнопки сохранения у них нет. |
| `frontend/src/components/hifz/HifzAssignments.tsx` | `handleSave` (строки 335–338): если `isNew && selected.size > 1` — `confirm({ message: t("hifz.assignment_issue_many_confirm", { count: selected.size }) })` и при «Отмене» выйти. Иначе сохранять сразу. Сохранение в обоих случаях обёрнуто в `useSingleFlight`. Удаление (строка 97) не трогать. |
| `frontend/src/components/EntityCrudPage.tsx` | `handleSubmit` (строки 262–290): после проверки полей `const extra = confirmMessage?.(formValues, editingRow); if (extra) { const ok = await confirm({ message: \`${extra}. ${t("common.confirm_save")}\` }); if (!ok) return; }`. Без `extra` вопроса нет. Всё тело после проверки обернуть в `useSingleFlight` (мутации через `mutateAsync().catch(() => {})`; `onError` и `onSuccess` остаются в `useMutation`). Обновить комментарии в строках 113–115 (документация пропа: «вопрос задаётся только если вернулся текст») и 263–264. Удаление и `forceDelete` (строка 225, окно `pendingDeleteId`) не трогать. |
| `frontend/src/pages/ScheduleGridPage.tsx` | `handleAddExisting` и `handleAddNew` (строки 241–251): без `confirm()`, через `useSingleFlight` + `mutateAsync`. Строки 213 (409 → удалить вместе с записями), 254 (удалить) и 267 (перенос) не трогать. |
| `frontend/src/hooks/useSingleFlight.ts` (новый) | `useSingleFlight()` возвращает `run(fn: () => Promise<unknown>)`. Пока предыдущий вызов не завершился, повторный игнорируется (`useRef<boolean>`, сброс в `finally`). Комментарий «почему»: `isPending` доходит до компонента через планировщик уведомлений, поэтому второе быстрое нажатие успевает уйти до того, как кнопка станет неактивной. |
| `frontend/src/pages/UsersPage.tsx` | Колонка `role`: `render: (row) => ROLE_LABEL_KEY[row.role] ? t(ROLE_LABEL_KEY[row.role]) : "—"`, где `ROLE_LABEL_KEY = { RECTOR: "users.role_rector", DEAN: "users.role_dean", TEACHER: "users.role_teacher" }`. Без шаблонного `t(\`users.role_${…}\`)`: незнакомая роль должна дать «—», а не ключ. `EntityCrudPage` использует `render` и в таблице, и в карточках на телефоне (строки 405–406), так что критерий 28 закрывается этим же изменением. |
| `frontend/src/Layout.tsx` | `const displayName = user?.full_name \|\| user?.username \|\| ""`. Строка 166 (меню на телефоне): `{displayName}`, у `Typography` уже есть `noWrap`, добавить `title={displayName}`. Ширину держит `DRAWER_WIDTH = 230`. Строка 265 (шапка ≥ md): `noWrap`, `minWidth: 0`, `maxWidth: { md: 240, lg: 360 }`, `overflow: hidden`, `textOverflow: ellipsis`, `title`. Текст `{displayName} · {roleLabel}`. Подтверждение выхода (строка 104) не трогать. |
| `frontend/src/i18n/locales/ky.json`, `ru.json`, `en.json` | В раздел `journal`: `attendance_short_present` (К / П / P), `attendance_short_absent` (Ж / Н / A), `attendance_short_late` (О / О / L), `attendance_short_excused` (С / У / E), `attendance_legend` = `"{{letter}} — {{label}}"` во всех трёх файлах (счётчик `: N` дописывает компонент, чтобы число осталось жирным). В раздел `hifz`: `assignment_issue_many_confirm` — ky «Тапшырма {{count}} окуучуга берилет. Улантасызбы?», ru «Задание получат учеников: {{count}}. Продолжить?», en «{{count}} students will get this assignment. Continue?». `common.confirm_save` не удалять. |

### e2e (пишет qa, но существующие тесты developer обязан поправить в шаге 4, иначе CI красный)

| Файл | Что сделать |
|---|---|
| `e2e/tests/ux-fixes/stand.ts` | `saveAndConfirm` (строки 32–40) разделить на две функции. `save(page, lang)` — нажимает «Сактоо», проверяет, что окна `common.confirm_title` нет. `saveAndConfirm(page, lang)` — остаётся только для замены преподавателя (C2): нажимает «Сактоо», ждёт вопрос и нажимает «Ооба». |
| `e2e/tests/ux-fixes/rector.spec.ts` | Заменить `saveAndConfirm` на `save` в строках 114, 120 (AC-11/12), 135 (AC-14), 152, 160, 165 (AC-15/16), 180 (AC-19), 194 (AC-21), 276 (AC-28: меняется только предмет; было `expect(question).not.toContain(...)`, стало «окна вопроса нет»), 289 (AC-28: смена группы), 352, 360 (AC-20), 382 (ru). `saveAndConfirm` **оставить** в строках 252 (AC-27, меняется преподаватель), 266 (AC-29, меняется преподаватель), 301 и 309 (B5.R1/R2/R5). Проверки `common.confirm_save` → `toHaveCount(0)` в строках 73, 95, 103 остаются верными. |
| `e2e/tests/login/*.spec.ts` | Не нажимают «Ооба»; по коду правок не требуют. Прогнать, чтобы убедиться. |
| `e2e/tests/ux-fixes/dean.spec.ts`, `teacher.spec.ts` | «Ооба» не нажимают, правок не нужно. |
| `e2e/fixtures/app.ts` | Добавить `en` в `LOCALES` (критерии 1 и 27 проверяются на трёх языках). |
| `e2e/fixtures/seed.py` | Под `E2E_EXTRA_DATA`: учитель `long_name_teacher` с ФИО ровно из 60 символов (критерий 43). У ученика хафиз-группы план 2026-10-27 — 2026-11-16 и экзамен 2026-11-05 (критерии 32–34); можно создать и через API в самом тесте. |

## Тесты

### pytest — `backend/tests/test_auth_me.py`

Клиент через `client_as` из `conftest.py`, данные через `factories.py`.

- `test_me_teacher_with_profile_returns_full_name`: `make_teacher` с `full_name="Асанов Бакыт Маратович"` → 200, `full_name` совпадает, `username == "teacher1"`, `role == "TEACHER"`.
- `test_me_hafiz_teacher_returns_full_name`: учитель, назначенный на группу `GroupType.HAFIZ`, получает своё ФИО (хафиз-учитель — та же роль TEACHER, тест фиксирует критерий 41).
- `test_me_teacher_without_profile_full_name_null`: `make_user(..., UserRole.TEACHER)` без профиля → `full_name is None`.
- `test_me_rector_full_name_null_other_fields_unchanged`: ректор → `full_name is None`. Проверить точный набор ключей ответа: старые 7 + `full_name`; `headed_department_id is None`.
- `test_me_dean_full_name_null_keeps_headed_department`: `make_dean` → `full_name is None`, `headed_department_id == department.id`.
- `test_me_returns_only_own_name`: два учителя; `client_as(teacher_a)` → ФИО A, в теле ответа нет ФИО B (критерий 45).
- `test_me_reflects_renamed_teacher`: ректор делает `PATCH /teachers/{id}` с новым `full_name`, затем `/me` учителя отдаёт новое ФИО (критерий 44).
- `test_me_without_token_401`: `app.dependency_overrides[get_db] = lambda: db` **без** подмены `get_current_user`; `GET /api/v1/auth/me` без заголовка → 401, с `Authorization: Bearer garbage` → 401. Overrides очистить в `finally`.
- `test_users_list_has_no_full_name`: ректор, `GET /users` → у элементов нет ключа `full_name` (контракт `/users` не изменился). Плюс `GET /users` для DEAN и TEACHER → 403 (критерий 31, права каждой роли).

Права по ролям: `/auth/me` — RECTOR, DEAN, TEACHER и хафиз-TEACHER покрыты тестами выше, аноним — 401. `/users` — RECTOR 200, DEAN 403, TEACHER 403. Права на справочники для TEACHER (403, критерий 25) уже покрыты существующими тестами (`test_reference_lists.py`, `test_assignments.py`); новых не нужно, сервер не меняется.

### e2e (qa) — `e2e/tests/ux-fixes-2/{teacher,hafiz,rector,dean,i18n}.spec.ts`

| Критерии | Что проверить |
|---|---|
| 1, 2, 5 | teacher, `/my-class`, урок сегодня: на ky, ru и en кнопки по порядку «К Ж О С» / «П Н О У» / «P A L E»; `getByRole("button", { name: tr("journal.attendance_present", lang) })`. Поставить отметку, сменить язык через шапку (desktop) или меню (mobile); буквы сменились, отметка `aria-pressed=true` сохранилась, после смены языка нет запросов `PUT`/`POST` к журналу (`page.on("request")`). |
| 3 | `i18n.spec.ts` без браузера: для ky, ru, en четыре `journal.attendance_short_*` попарно различны и непусты. |
| 4 | Проверка на ревью: в `frontend/src` нет `ATTENDANCE_SHORT` и литералов букв статусов. |
| 6 | Счётчики: «К — Келди: N» (ky), «П — Присутствовал: N» (ru); при неотмеченных учениках есть «Белгиленген жок». |
| 7 | Проект mobile 390×844: `boundingBox()` каждой из 4 кнопок ≥ 44×44, `font-size` ≥ 16px; `document.scrollingElement.scrollWidth <= clientWidth`; правая граница кнопок ≤ 390. На `/my-class` и на вкладке «Сабак» хафиз-журнала. |
| 8 | desktop 1280×800: кнопки ≥ 44×44. На `/my-class` у `TableContainer` `scrollWidth <= clientWidth`. В хафиз-таблице ширина ячейки посещаемости (сетка 2×2) ≤ 110 px, то есть кнопки не расширяют таблицу. |
| 9 | Выбранная кнопка в светлой и ночной теме: цвет текста белый, фон — `STATUS_SOLID` (сравнить computed style с прежним). |
| 10 | Ученик с освобождением (в seed есть «Ооруп калды»): 4 кнопки `disabled`, «С» выбрана, видно «Деканат: …». |
| 11, 24 | Нажатие ставит статус, повторное снимает; «Баарын келди деп белгилөө» работает; за урок нет ни одного окна `common.confirm_title`; подпись «Сакталууда…» сменяется подсказкой. |
| 12 | Ректор и декан в журнале-сетке не видят кнопок посещаемости (там режим только чтения). |
| 13 | Профиль ученика и «Үлгерүү» показывают полные слова; буквы хифза «Ж/К» в сетке на месте. |
| 14, 15, 16 | Rector `/rooms`: создать и изменить — окна вопроса нет, «Кошулду» и «Сакталды». Dean: создать группу в своей кафедре — без вопроса. Пустое обязательное поле подсвечено, запроса нет. Ошибка сервера (дубль кода предмета) — сообщение в форме, форма открыта, данные на месте. |
| 17 | Замена преподавателя: вопрос с `assignments.teacher_replace_warning`; «Жокко чыгаруу» — запроса `PATCH` нет, форма открыта; «Ооба» — «Сакталды». Изменение только вида часов — вопроса нет. Покрывается и обновлёнными AC-27/28 из `ux-fixes/rector.spec.ts`. |
| 18 | Rector и dean: добавить урок в пустую ячейку `/schedule` (оба режима: существующее и новое назначение) — урок в сетке, вопроса нет. |
| 19 | teacher, mobile: заметка добавлена, поле пустое, вопроса нет. |
| 20 | hafiz: добавить и изменить план, затем экзамен — вопроса нет, запись в списке, форма очищена; «Сакталды» видно и через 3 с. |
| 21 | Задание одному ученику — без вопроса, «Тапшырма берилди». Двум ученикам — вопрос с числом «2»; «Жокко чыгаруу» — `POST /hifz/targets/bulk` нет, окно открыто. |
| 22 | `dblclick()` на «Сактоо» и «Кошуу» в C1 (`/rooms`), C10 (заметка), C12 (план): на сервер ушёл ровно 1 `POST` (счётчик запросов), в списке одна новая запись. |
| 23 | Остаются вопросы: удаление в справочнике, удаление студента с записями, перенос и удаление урока, завершение урока (оба журнала), удаление плана, экзамена и задания, очистка дня. «Жокко чыгаруу» не шлёт `DELETE/PATCH/POST`. |
| 25 | teacher: кнопок «Кошуу» в справочниках нет; `POST /rooms` → 403. |
| 26 | Обновлённый `ux-fixes/rector.spec.ts` зелёный. |
| 27–30 | Rector `/users` на desktop и mobile, на ky, ru и en: «Ректор», «Кафедра башчысы» / «Заведующий кафедрой» / «Dean»; `getByText("RECTOR", { exact: true })` и `"DEAN"` → 0. Смена языка без перезагрузки меняет подпись. Критерий 30 (неизвестная роль) — через `page.route` подменить ответ `/users` ролью `"OTHER"` и ожидать «—». |
| 31 | Dean и teacher: пункта «Админ-аккаунттар» нет, `GET /users` → 403. |
| 32–36 | hafiz: в окне планов «Жаттоо — 27.10.2026 — 16.11.2026», нет `2026-10-27` и `→`. Экзамен — «05.11.2026» на ky, ru и en (по решению 4 — один формат). Rector и dean в журнале-сетке видят ту же дату в окне экзаменов. Отдельный `test.use({ timezoneId: "America/Los_Angeles" })` и `"Asia/Bishkek"` — дата та же. Поле `type="date"` при изменении показывает `2026-10-27`, в запросе уходит `"2026-10-27"`. |
| 37 | У ректора и декана в окне экзаменов нет кнопки сохранения; `POST /hifz/exams` → 403. |
| 38, 45 | `GET /auth/me` через `page.request`: у teacher `full_name == "Мамытов Азамат"`, у rector `null`; без токена 401. |
| 39–42 | teacher и hafiz: mobile — первая строка меню ФИО, под ним «Мугалим», логина `teacher` нет; desktop — в шапке «Мамытов Азамат · Мугалим». Rector — «rector · Ректор». |
| 43 | `long_name_teacher`: mobile — ширина бумаги меню ≤ 230, у строки ФИО `scrollWidth > clientWidth` (обрезано) и одна строка. Desktop 900×800 — кнопки «Чыгуу» и темы целиком в пределах `viewport`. |
| 46, 47 | Покрыто проверками на трёх языках и проверкой ночной темы в критерии 9. |
| 48 | `pytest -q`, `npm run lint`, `npm run build` — в CI. |

## Риски

- **Видео и руководства.** 16 сценариев в `videos/scenarios/` (`departments.md`, `admin-accounts.md`, `assignments.md`, `groups.md`, `excuses.md`, `hifz-assignments.md`, `rooms.md`, `hifz-plans-exams.md` (дважды), `schedule-edit.md`, `semesters.md`, `students.md`, `subjects.md`, `teacher-notes.md`, `teachers.md`, `timeslots.md`, `_template.md`) нажимают «Ооба / Да» после сохранения. После релиза при перезаписи видео эти шаги упадут: окна больше нет. По спеке в этой фиче их не трогаем; обновят video-scriptwriter и docs после релиза. В `assignments.md` шаг «Да» останется верным, только если в сценарии меняется преподаватель. То же с `docs/user-guide/*.md`.
- **Двойное нажатие.** Вопрос раньше служил защитой от двойного создания. Без него защищают `useSingleFlight` и `disabled={isPending}`, проверка — e2e `dblclick` (критерий 22). Серверной идемпотентности нет; для справочников с уникальными полями дубль отсечёт 409/400, для заметок и планов — нет.
- **Раскладка «Менин классым» на телефоне.** Карточки вместо таблицы меняют разметку. e2e, которые ищут на телефоне `getByRole("row")` в этом журнале, сломаются. Сейчас таких нет: проверено в `e2e/tests/**`.
- **Ширина хафиз-таблицы на 1280.** Таблица и сейчас шире ~1000 px доступного места (9 колонок с полями ввода). Сетка 2×2 делает ячейку посещаемости ~92 px вместо прежних ~120, так что кнопки прокрутку не добавляют. Полностью убрать прокрутку этой таблицы — вне рамок. Если qa трактует критерий 8 как «прокрутки нет совсем», это вопрос к человеку (см. ниже).
- **Ширина 600–899 px (планшет).** Таблицы, меню-шторка; критериев на эту ширину нет. Кнопки 44 px могут вызвать прокрутку хафиз-таблицы; приемлемо.
- **Поиск на `/users`.** Поиск фильтрует по `JSON.stringify(row)`, поэтому по слову «Ректор» не находит (в данных `RECTOR`). Было так и раньше; вне рамок.
- **Текст в спеке и в переводах.** В критерии 32 для ru написано «Хифз — …», но `ru.json` `hifz.kind_hifz` = «Жаттоо». e2e должны брать текст через `tr("hifz.kind_hifz", "ru")`, а не литералом. Переводы не меняем.
- **Обратная совместимость API.** К `/auth/me` добавлено поле, старые клиенты (кэш PWA) его игнорируют. Новый фронтенд со старым бэкендом (Cloudflare Pages выкатывается тегом, Render — с `main`) получит `undefined` → сработает запасной вариант `username`. Порядок выкладки значения не имеет.
- **Производительность.** `/me`: одна дополнительная ленивая выборка `teacher_profile` на запрос, индекс `teacher_profiles.user_id` уже служит для связи. Списков и N+1 нет.
- **Безопасность.** `/me` отдаёт только своё ФИО; новых адресов и ролей нет. Скрытие кнопок по-прежнему не защита, права на сервере не меняются.
- **Данные в проде.** Миграции и изменений данных нет.
- **Религиозный контент.** Нет: «хифз», «такрар», «жаттоо», «джуз» используются только как названия разделов. Пометка не требуется.

## Порядок работы

1. **Бэкенд `/auth/me`.** `MeOut` в `schemas/auth.py`, `auth.py`, `tests/test_auth_me.py`. → `pytest -q` зелёный.
2. **B11 и B9 во фронтенде.** `types.ts` (`full_name`), `Layout.tsx` (ФИО, обрезка), `UsersPage.tsx` (`render` роли). → `npm run lint && npm run build` зелёные.
3. **B7.** Ключи в `ky/ru/en.json`, `lib/attendance.ts`, `AttendanceToggle.tsx` (aria-label, 44×44, `layout`, `fullWidth`, `common.white`), `AttendanceLegend.tsx`, `TeacherClassPage.tsx` (карточки на телефоне, легенда), `HifzJournalPage.tsx` (легенда, `fullWidth`, `grid`). Руками проверить 390×844 и 1280×800 в светлой и ночной теме. → lint и build зелёные.
4. **B8.** `hooks/useSingleFlight.ts`. Затем `EntityCrudPage.tsx`, `ScheduleGridPage.tsx`, `TeacherClassPage.tsx` (NotesDialog), `HifzJournalPage.tsx` (HifzTargetsDialog + `onSaved`), `HifzExamsDialog.tsx` (+ `onSaved`), `HifzGradebook.tsx`, `HifzAssignments.tsx` (вопрос только при > 1 ученике), ключ `hifz.assignment_issue_many_confirm` в трёх языках. Обновить `e2e/tests/ux-fixes/stand.ts` (`save` и `saveAndConfirm`) и `rector.spec.ts` по списку строк выше. → lint и build зелёные, `npx playwright test tests/ux-fixes tests/login` зелёный.
5. **B10.** `fmtDate` в `HifzJournalPage.tsx:838` и `HifzExamsDialog.tsx:161`. → lint и build зелёные.
6. **Итог.** Полный `pytest -q`, `npm run lint && npm run build`, полный прогон `e2e` (существующие тесты). Передать reviewer.

## Вопросы

Блокирующих нет. Неблокирующий, на решение человека, если qa поднимет вопрос: критерий 8 для хафиз-таблицы на 1280 px понимается как «кнопки не добавляют прокрутки». Таблица из 9 колонок с полями ввода прокручивается и сейчас, независимо от кнопок.
