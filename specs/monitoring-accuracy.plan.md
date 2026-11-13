# План: Точный мониторинг учителей
Спека: specs/monitoring-accuracy.md · Ветка: feature/monitoring-accuracy

## Решение

Весь подсчёт переносится в одну внутреннюю функцию `services/monitoring.py::_occurrences(...)`. Она один раз загружает записи расписания, уроки, отметки, нерабочие дни, флаги «требует внимания» и порог опоздания и отдаёт по каждому уроку (запись + дата) его статус. `teacher_monitoring`, `teacher_monitoring_summary` и `teacher_session_log` только складывают или выводят этот список. Поэтому цифры на главной, в «Мониторинге» и в журнале по дням не могут разойтись (1.11, 2.20). «Сейчас» — это `datetime` по Бишкеку из одной функции `now_bishkek()`; в сервисах она заменяет параметр `today` и легко подменяется в тестах (1.9). Период обрезается датами семестра, а урок, пара которого ещё идёт, ожидается только если он уже открыт. Отметки причин лежат в отдельной таблице `lesson_marks` с ключом (запись расписания, дата). `LessonSession` они не создают, поэтому история студента, журнал и посещаемость не меняются. Нерабочие дни — отдельная таблица диапазонов дат. Порог опоздания хранится в таблице настроек `app_settings`, где всегда одна строка. Отброшенные варианты:
- создавать «фиктивный» `LessonSession` для «забыл открыть»: ломает историю студента и сводку посещаемости, а спека это запрещает;
- хранить статус урока в таблице на каждую дату: расписание правят задним числом, и такая таблица разойдётся с ним;
- хранить настройки как ключ-значение: нет проверки типа и диапазона на уровне БД;
- менять форму ответа `/monitoring/teachers` со списка на объект. Бэкенд выкатывается с `main` раньше, чем фронтенд по тегу, и старый фронтенд упал бы. Поэтому все изменения ответов только добавляют поля, а признак «период вне семестра» фронтенд считает сам по уже загруженному списку семестров.

## Модель данных и миграции

Одна миграция `backend/alembic/versions/<rev>_monitoring_accuracy.py`, `down_revision = '3b9e6d1f2a40'`. Нужна только для шага 2; шаг 1 схему не меняет. Тесты идут через `Base.metadata.create_all`, поэтому все ограничения описываются ещё и в моделях. Сгенерированный файл обязательно прочитать и поправить руками.

**`non_working_days`** (модель `NonWorkingDay`, `models/non_working_day.py`)
- `id` PK; `name String(255) NOT NULL`; `start_date Date NOT NULL`; `end_date Date NOT NULL`;
- `created_by_user_id FK users.id ON DELETE SET NULL NULL`; `created_at DateTime(tz) server_default now()`;
- `CheckConstraint("end_date >= start_date", name="ck_non_working_day_range")`;
- `Index("ix_non_working_days_start_end", "start_date", "end_date")`.
- Пересечения диапазонов разрешены: они безвредны, день просто нерабочий.

**`lesson_marks`** (модель `LessonMark`, `models/lesson_mark.py`)
- `id` PK; `schedule_entry_id FK schedule_entries.id ON DELETE CASCADE NOT NULL`; `date Date NOT NULL`;
- `kind Enum(LessonMarkKind, name="lesson_mark_kind") NOT NULL`, значения `FORGOT_TO_OPEN | EXCUSED | CANCELLED` (в `models/enums.py`);
- `comment String(500) NULL`;
- `marked_by_user_id FK users.id ON DELETE SET NULL NULL`; `marked_at DateTime(tz) NOT NULL`. Смена причины перезаписывает оба поля: показываем, кто поставил текущую отметку и когда;
- `UniqueConstraint("schedule_entry_id", "date", name="uq_lesson_mark_entry_date")` — этот же индекс используется для выборки по периоду;
- связь `marked_by: Mapped[User | None]` нужна, чтобы показывать имя (`username`) через `selectinload`.
- Ответственного учителя не храним. Его считает `responsible_teacher_id(entry, date, changes, None)`, так же как для пропусков (2.15).

**`app_settings`** (модель `AppSettings`, `models/app_settings.py`)
- `id Integer PK`; `late_threshold_minutes Integer NOT NULL server_default '15'`;
- `CheckConstraint("id = 1", name="ck_app_settings_single_row")`, `CheckConstraint("late_threshold_minutes BETWEEN 0 AND 60", name="ck_app_settings_late_threshold")`.
- Миграция вставляет строку `(1, 15)` через `op.bulk_insert`. Сервис читает с запасным значением 15, если строки нет (так в тестах на SQLite и на стенде e2e).

**Перенос данных:** не нужен, все три таблицы новые. Существующие `lesson_sessions` и `attendance_records` не меняются.

**Откат (`downgrade`):** `drop_table('lesson_marks')`, затем `sa.Enum(name='lesson_mark_kind').drop(op.get_bind(), checkfirst=True)` (Postgres сам тип не удаляет), `drop_index` и `drop_table('non_working_days')`, `drop_table('app_settings')`. Теряются только отметки, нерабочие дни и порог, введённые после выката, — это прямо написать в docstring миграции. Уроки, посещаемость и оценки не затрагиваются.

**Проверка миграции** (на локальном Postgres из `docker compose`, не на Neon): `alembic upgrade head` → `alembic downgrade -1` → `alembic upgrade head`.

## API

Общие правила:
- область отделения для ректора и декана считает новая зависимость `core/deps.py::department_scope(current_user) -> int | None`: ректор — `None`, декан — id его отделения, декан без отделения — **403**. Сейчас декан без отделения получает `department_id=None` и видит всё медресе — это дыра, закрываем (1.15, 1.16);
- неизвестный `semester_id` в мониторинге и на главной — 404.

| Метод и путь | Роли (require_role / доступ к кафедре) | Запрос | Ответ | Ошибки |
|---|---|---|---|---|
| GET `/monitoring/teachers` (изменён) | RECTOR — всё; DEAN — `department_scope`; TEACHER — 403 | `semester_id, date_from, date_to` | `list[TeacherMonitoringRowOut]`: прежние поля + `conducted_percent: int \| null`, `attention_lessons: int`; порядок по п. 1.7 | 403, 404 семестр, 422 |
| GET `/monitoring/teachers/{teacher_id}/sessions` (изменён) | RECTOR; DEAN — `assert_department_access(teacher.department_id)`; TEACHER — 403 | `semester_id, date_from, date_to` | `list[TeacherSessionLogRowOut]`: прежние поля + `schedule_entry_id`, `status: CONDUCTED\|CONDUCTED_BY_MARK\|MISSED\|EXCUSED\|CANCELLED`, `mark: LessonMarkOut \| null`, `no_student_marks: bool`, `early_finish: bool`, `can_mark: bool`; `conducted` = статус CONDUCTED или CONDUCTED_BY_MARK (для старого фронтенда) | 403, 404 учитель/семестр |
| GET `/dashboard/teacher-monitoring-summary` (изменён) | RECTOR; DEAN — `department_scope`; TEACHER — 403 | `semester_id, date_from, date_to` | прежние поля + `conducted_percent: int \| null`, `attention_lessons: int`, `lowest_percent: list[Row]` (≤5, процент < 100, порядок 1.7); `top_missed` остаётся со старым смыслом для старого фронтенда — пометить в коде как устаревшее | 403, 404 |
| GET `/dashboard/student-attendance-summary` (изменён) | как выше | как выше | без изменений формы; «сегодня» — по Бишкеку, период обрезан семестром | 403, 404 |
| PUT `/monitoring/lesson-marks` (новый) | RECTOR; DEAN — `assert_department_access` по отделению учителя, отвечавшего за урок в эту дату; TEACHER — 403 | `{schedule_entry_id, date, kind, comment?: str ≤500}` — upsert по (запись, дата) | 200 `LessonMarkOut {id, schedule_entry_id, date, kind, comment, marked_by: str \| null, marked_at}` | 403; 404 запись; 422 — неверный `kind`, `comment` > 500, день недели даты ≠ `entry.day_of_week`; 409 `lesson_opened` / `lesson_not_ended` / `outside_semester` / `non_working_day` (2.13, 2.28) |
| DELETE `/monitoring/lesson-marks/{mark_id}` (новый) | как PUT | — | 204 | 403, 404 |
| GET `/non-working-days` (новый) | RECTOR, DEAN (только чтение, без пункта меню у декана); TEACHER — 403 | — | `list[NonWorkingDayOut {id, name, start_date, end_date}]` по `start_date` убыв. | 403 |
| POST `/non-working-days` (новый) | RECTOR; DEAN, TEACHER — 403 | `{name, start_date, end_date}`; `name` обрезается, не пустой, ≤255; `end_date ≥ start_date` (`model_validator`) | 201 `NonWorkingDayOut` | 403, 422 |
| PATCH `/non-working-days/{id}` (новый) | RECTOR; DEAN, TEACHER — 403 | частичный, итоговый диапазон проверяется | 200 | 403, 404, 422 |
| DELETE `/non-working-days/{id}` (новый) | RECTOR; DEAN, TEACHER — 403 | — | 204 | 403, 404 |
| GET `/settings` (новый) | RECTOR, DEAN; TEACHER — 403 | — | `{late_threshold_minutes: int}` | 403 |
| PATCH `/settings` (новый) | RECTOR; DEAN, TEACHER — 403 | `{late_threshold_minutes: int, 0..60}` | 200 `{late_threshold_minutes}`; если строки нет — создаёт её | 403, 422 |
| DELETE `/schedule/{id}` (поведение) | без изменений | — | дополнительно удаляет `lesson_marks` записи через ORM, чтобы SQLite и Postgres вели себя одинаково | без изменений |

Правило `can_mark` (тот же код, что проверка в PUT): статус MISSED, EXCUSED, CANCELLED или CONDUCTED_BY_MARK. Статус CONDUCTED (урок открыт) отметить нельзя, а строк для незакончившихся пар и нерабочих дней в журнале нет вообще.

## Правила подсчёта в `_occurrences` (для developer)

Для каждой записи расписания семестра (`selectinload` на `time_slot` и `assignment.group`) и каждой даты её дня недели в периоде:

1. Период: `start = max(date_from, sem.start_date)`, `end = min(date_to, sem.end_date, now.date())`. Если `start > end`, уроков нет.
2. Урок открыт (`LessonSession` есть) → `CONDUCTED`; ожидается, проведён; считаются опоздание и флаги внимания. Это так даже в нерабочий день (2.3).
3. Урок не открыт и `datetime.combine(d, slot.end_time, BISHKEK) > now` → пропускаем (1.1, 1.9).
4. Урок не открыт и дата в нерабочем дне → пропускаем. Отметку на эту дату игнорируем: например, если день объявили нерабочим уже после отметки.
5. Есть отметка `EXCUSED` или `CANCELLED` → строка видна со статусом причины, урок не ожидается.
6. Есть отметка `FORGOT_TO_OPEN` → `CONDUCTED_BY_MARK`, урок ожидается и проведён, без флагов и без опоздания.
7. Иначе → `MISSED`.

Ещё правила:
- **Учитель урока:** `responsible_teacher_id(entry, d, changes, session.teacher_id if session else None)` — как сейчас.
- **Опоздание:** `_is_late(checked_in_at, d, start_time, threshold)`, порог берётся из `services/settings.get_late_threshold(db)` один раз на запрос.
- **`no_student_marks`:** у урока нет ни одной `AttendanceRecord` с `excuse_id IS NULL`. Для хафиз-группы (`group.group_type == HAFIZ`) ещё и нет ни одной `HifzRecord` студентов этой группы за дату (2.21). Обе проверки — по одному запросу на весь период: `select distinct session_id …` и `select distinct Student.group_id, HifzRecord.date … join Student`.
- **`early_finish`:** `checked_out_at` есть и он раньше `start + (end − start) / 2` по Бишкеку. Автозакрытие ставит время ≥ конца пары, поэтому под условие не попадает само (2.18).
- **«Требует внимания»:** `attention = no_student_marks or early_finish`, считается один раз на урок (2.19).
- **Процент:** целочисленное округление половины вверх, `(conducted * 200 + expected) // (2 * expected)`, без `round()`, который округляет к чётному. Если `expected == 0` → `None`.
- **Сортировка:** `(percent is None, percent or 0, -missed, full_name.casefold())`.
- **Проверка в PUT отметки** использует те же функции (`_pair_ended`, `_is_non_working`, границы семестра), чтобы правило 2.13 не разошлось с `can_mark`.

## Изменения по файлам

| Файл | Что сделать |
|---|---|
| `backend/app/core/deps.py` | `department_scope(current_user)`: RECTOR → None, DEAN → id отделения, DEAN без отделения → 403 |
| `backend/app/services/monitoring.py` | `now_bishkek()`. Параметр `today` → `now: datetime \| None` во всех четырёх функциях. Добавить `_occurrences` и правила выше; поля строк `conducted_percent`, `attention_lessons`; в журнале по дням `status`, `mark`, `no_student_marks`, `early_finish`, `can_mark`, `schedule_entry_id`. В сводке `conducted_percent`, `attention_lessons`, `lowest_percent`. `student_attendance_summary` — обрезка семестром и `now.date()`. Убрать константу `LATE_THRESHOLD_MINUTES`, а для единственного источника значения по умолчанию оставить `DEFAULT_LATE_THRESHOLD = 15`. Функции проверки отметки: `validate_mark_target(db, entry, d, now) -> None` (кидает доменные исключения), `upsert_mark`, `delete_mark` |
| `backend/app/services/settings.py` (новый) | `get_late_threshold(db) -> int` (нет строки → 15), `set_late_threshold(db, minutes)` |
| `backend/app/models/enums.py` | `LessonMarkKind` |
| `backend/app/models/non_working_day.py`, `lesson_mark.py`, `app_settings.py` (новые); `models/__init__.py` | модели, как в разделе выше; зарегистрировать в `__all__` |
| `backend/alembic/versions/<rev>_monitoring_accuracy.py` (новый) | одна миграция, как выше |
| `backend/app/schemas/monitoring.py` (новый) | `TeacherMonitoringRowOut`, `TeacherMonitoringSummaryOut`, `TeacherSessionLogRowOut`, `LessonMarkUpsert` (`comment: str \| None = Field(max_length=500)`), `LessonMarkOut` |
| `backend/app/schemas/non_working_day.py`, `schemas/settings.py` (новые) | Create/Update/Out; валидатор диапазона и непустого названия; `late_threshold_minutes: int = Field(ge=0, le=60)` |
| `backend/app/api/v1/monitoring.py` | `department_scope`; `response_model`; 404 на семестр; PUT/DELETE `lesson-marks`; доменные исключения перевести в 409 с кодом в `detail` |
| `backend/app/api/v1/dashboard.py` | `department_scope` для двух эндпоинтов мониторинга; `response_model` для сводки |
| `backend/app/api/v1/non_working_days.py`, `api/v1/settings.py` (новые); `api/v1/router.py` | CRUD и настройки, роли — по таблице API |
| `backend/app/api/v1/schedule.py` | при удалении записи удалять её `LessonMark` (ORM `delete(...)`) |
| `backend/tests/factories.py` | `bishkek(d, hh, mm)` (aware-datetime), `make_non_working_day`, `make_lesson_mark` |
| `backend/tests/test_monitoring.py`, `test_hifz.py`, `test_teacher_replacement.py` | заменить `today=` на `now=bishkek(d, 23, 59)` (раньше все уроки «сегодня» считались — смысл сохраняется) |
| `backend/tests/test_monitoring_rules.py`, `test_monitoring_api.py`, `test_lesson_marks.py`, `test_non_working_days.py`, `test_settings.py` (новые) | см. раздел «Тесты» |
| `frontend/src/api/types.ts` | расширить `TeacherMonitoringRow`, `TeacherMonitoringSummary`, `TeacherSessionLogRow`; новые `LessonMark`, `LessonMarkKind`, `SessionStatus`, `NonWorkingDay`, `AppSettings` |
| `frontend/src/api/entities.ts` | `nonWorkingDaysApi = crud<NonWorkingDay>("/non-working-days")`; `settingsApi.get/update`; `monitoringApi.upsertMark`, `monitoringApi.removeMark` |
| `frontend/src/lib/monitoring.ts` (новый) | `percentColor(p)` (≥90 / 70–89 / <70 → `STATUS_FILL.present/late/absent`); `periodOutsideSemester(range, semester)` — для 1.5 |
| `frontend/src/pages/TeacherMonitoringPage.tsx` | удалить `performanceScore` и брать `conducted_percent` с сервера. Колонка `col_percent` вместо `col_score`, «—» при null. Колонка и плитка `col_attention` (жёлтый чип при > 0). На телефоне сетка плиток `repeat(auto-fit, minmax(64px, 1fr))` без горизонтальной прокрутки (1.10, 2.16). Alert `out_of_semester`. В журнале по дням: чип статуса по `status` (причины — серым), текст причины, комментарий, `mark_by`; чипы `flag_no_marks` и `flag_early_finish`; кнопка «Себебин белгилөө» при `can_mark` (на телефоне `fullWidth`, `minHeight: 44`) |
| `frontend/src/components/LessonMarkDialog.tsx` (новый) | `RadioGroup` из трёх причин, поле комментария (до 500), «Сактоо» неактивна без выбора, «Жокко чыгаруу». Для отмеченного урока — «Белгини алып салуу» с `useConfirm`. `fullScreen` на телефоне. После успеха — `invalidateQueries(["monitoring"])` и `["dashboard-teacher-monitoring"]` (2.14) |
| `frontend/src/pages/DashboardPage.tsx` | плитки «Проведено %» (`percentColor`) и «Требует внимания»; список `lowest_percent` с чипом `NN%` и числом пропусков, заголовок `dashboard.lowest_percent_title`; пустой список → прежний `no_missed_hint` |
| `frontend/src/components/EntityCrudPage.tsx` | необязательные пропсы: `validate?: (values) => Record<string, string>` (ошибки под полями до запроса), `deleteConfirmText?: string`, `labeledActions?: boolean` (на десктопе — кнопки с текстом вместо иконок). Остальные страницы не меняются |
| `frontend/src/pages/NonWorkingDaysPage.tsx` (новый) | `EntityCrudPage<NonWorkingDay>`: колонки и поля name/start/end, `validate` (тексты 2.4), `deleteConfirmText`, `labeledActions`, `emptyHint` |
| `frontend/src/pages/TimeSlotsPage.tsx` + `components/LateThresholdCard.tsx` (новый) | над таблицей звонков — карточка с числовым полем (0–60, текст ошибки по 2.22) и кнопкой «Сактоо»; после сохранения — `invalidateQueries(["monitoring"])` |
| `frontend/src/App.tsx` | маршрут `/non-working-days` в `RoleRoute roles={["RECTOR"]}` |
| `frontend/src/Layout.tsx` | пункт `nav.non_working_days` после «Семестрлер», только для RECTOR |
| `frontend/src/i18n/locales/{ky,ru,en}.json` | все ключи из таблицы спеки и `non_working_days.title`; удалить ставшие ненужными `monitoring.col_score` и `dashboard.top_missed_title`; английский — перевод developer |
| `e2e/fixtures/seed.py` | см. «Риски» (данные стенда для «Требует внимания»); правка согласуется с qa |

## Тесты

### pytest — шаг 1 (`test_monitoring_rules.py`, расширение `test_monitoring.py`)

- `test_running_pair_not_expected_until_end` — 1.1: пара 10:00–10:45, `now = 10:30`; урока нет ни в плане, ни в пропусках, ни в журнале по дням.
- `test_ended_pair_counts_as_missed` — 1.2: `now = 10:46`; план +1, пропуск +1, строка в журнале со статусом MISSED.
- `test_open_running_lesson_counts_as_conducted` — 1.3: урок открыт в 10:05, `now = 10:20` → план 1, проведено 1.
- `test_period_clamped_to_semester` — 1.4: период 25.08–07.09, считается только 07.09.
- `test_period_outside_semester_returns_empty` — 1.5: пустой список (сообщение показывает фронтенд).
- `test_conducted_percent_and_sorting` — 1.6, 1.7: учитель А 9/10 → 90, учитель Б 2/4 → 50, Б выше. Равный процент → больше пропусков выше, затем ФИО. Учитель с `None` — в конце.
- `test_percent_rounds_half_up` — 89/89,5 и 88,5 → 89 (не банковское округление).
- `test_late_does_not_reduce_percent` — 1.8: опоздание не снижает процент.
- `test_now_is_bishkek_not_utc` — 1.9: `now = 2026-11-13 23:30 UTC`; пара 14.11 08:00 не считается, пары 13.11 считаются. Плюс отдельный тест, что `now_bishkek()` возвращает aware-datetime в `Asia/Bishkek`.
- `test_summary_equals_sum_of_rows` — 1.11, 1.12: при общих данных (несколько учителей, отделений, пропуски, опоздания) сводка равна суммам строк, процент сводки = Σпроведено / Σожидается.
- `test_summary_lowest_percent_top5` — 1.13: ≤5 строк, только < 100, порядок 1.7; без пропусков список пустой.
- `test_student_attendance_summary_clamped_to_semester_and_now` — 1.14.
- `test_monitoring_does_not_n_plus_1` — считать запросы через `event.listen(engine, "before_cursor_execute")`: число запросов не растёт с числом записей расписания (2 записи против 10).
- Существующие тесты (переведены на `now=`) остаются зелёными: учёт замены учителя, хафиз-уроки в мониторинге, автозакрытие.

### pytest — права шага 1 (`test_monitoring_api.py`, через `client_as`)

- Ректор: 200 на все четыре адреса, видит все отделения — 1.15.
- Декан: видит в списке и сводке только своё отделение, суммы только по нему — 1.15. Журнал учителя чужого отделения → 403 — 1.16.
- Декан без отделения: 403 на все четыре адреса (сейчас он видит всё).
- Учитель (обычный и хафиз): 403 на `/monitoring/teachers`, `/monitoring/teachers/{id}/sessions`, `/dashboard/teacher-monitoring-summary`, `/dashboard/student-attendance-summary` — 1.17.
- Неизвестный семестр → 404.
- Через HTTP с подменой `monitoring.now_bishkek` (monkeypatch): сценарий 1.9 на уровне эндпоинта.

### pytest — шаг 2

`test_non_working_days.py`:
- Ректор создаёт, меняет и удаляет запись; список отсортирован — 2.1, 2.5.
- `end < start` → 422; пустое название или одни пробелы → 422 — 2.4.
- Нерабочий день убирает неоткрытые уроки из плана и пропусков и из журнала по дням, в том числе у учителя другого отделения — 2.2, 2.7.
- Урок, открытый в нерабочий день, входит в план и в проведённые — 2.3.
- После удаления дня уроки снова считаются — 2.5.
- Права: декан — GET 200, POST/PATCH/DELETE 403 (2.26); учитель — 403 на все четыре (2.29).

`test_lesson_marks.py`:
- FORGOT_TO_OPEN: 10/8/2 → 10/9/1, 90%; в журнале статус CONDUCTED_BY_MARK, есть `mark.kind`, `comment`, `marked_by`, `marked_at` — 2.10.
- EXCUSED и CANCELLED: 10/8/2 → 9/8/1, 89%, строка видна со статусом причины — 2.11.
- Повторный PUT меняет причину и `marked_by`; DELETE возвращает 10/8/2 и статус MISSED — 2.12.
- 409: открытый урок (2.13, 2.28); пара ещё не закончилась; дата вне семестра; нерабочий день. 422: день недели не совпадает, `comment` > 500, неизвестный `kind`.
- Отметка не создаёт `LessonSession`, `AttendanceRecord`, `GradeRecord` (их число до и после одинаковое); `student_attendance_summary` не меняется — 2.28.
- Замена учителя: отметка на дату до замены уходит к прежнему учителю, после — к новому — 2.15.
- Права: ректор ставит у любого отделения. Декан ставит, меняет и снимает у своего (2.24); у чужого → 403 и на PUT, и на DELETE (2.25); если урок до замены вёл учитель чужого отделения → 403. Учитель → 403 на PUT и DELETE (2.29).
- Прошлый неактивный семестр: отметка в его датах проходит (вопрос 7).
- Удаление записи расписания удаляет её отметки.
- `can_mark` в журнале по дням: true только для MISSED, EXCUSED, CANCELLED, CONDUCTED_BY_MARK.

`test_monitoring_rules.py` (внимание):
- Открытый урок без отметок, только с записями `excuse_id` → проведён, `attention_lessons = 1`, `no_student_marks` — 2.17.
- Ранний выход (10:00–10:40, открыт 10:02, закрыт 10:15) → `early_finish`; автозакрытие через `auto_close_if_ended` → флага нет — 2.18.
- Оба флага сразу → в сумме 1, в строке оба — 2.19.
- Сводка `attention_lessons` = сумма по строкам — 2.20.
- Хафиз-урок без посещаемости, но с `HifzRecord` студента группы за дату → без `no_student_marks`; запись за другую дату или другой группы не помогает — 2.21.
- Внимание не снижает процент (вопрос 4).

`test_settings.py`:
- GET без строки → 15. Ректор PATCH 10 → 200; −1 и 61 → 422 — 2.22.
- Урок, открытый через 12 мин после начала: при пороге 15 — не опоздание; после PATCH 10 — опоздание и в списке, и в журнале по дням — 2.23.
- Декан: GET 200, PATCH 403 (2.27). Учитель: GET и PATCH 403 (2.29).

Учитель не затронут:
- `test_journal.py` и `test_hifz.py` зелёные без изменений, кроме перевода `today` → `now`. Новый тест: открытие урока в нерабочий день через `get_or_create_session` работает — 2.30.

### e2e (qa, `e2e/tests/monitoring-accuracy/{rector,dean,teacher,hafiz}.spec.ts`)

Часы бэкенда на стенде настоящие, поэтому сценарии с точным временем (1.1/1.2 в 10:30 и 10:46, 1.9) проверяются только в pytest. e2e проверяет:
- **rector:**
  - сегодняшний неоткрытый урок пары 1 (идёт весь день) не входит в план — 1.1;
  - колонка «Өткөрүлгөн %», порядок строк, цвета чипов — 1.6–1.8;
  - период до 01.09 → сообщение «вне семестра» — 1.5;
  - плитки главной равны суммам колонок «Мониторинга» — 1.11, 1.12;
  - список «Эң төмөн көрсөткүч» — 1.13;
  - на телефоне 375 px нет горизонтальной прокрутки, есть 5 плиток — 1.10, 2.16;
  - нерабочий день: добавить на дату пропуска teacher2 → цифры уменьшились, строка исчезла; ошибки 2.4; удалить с подтверждением → цифры вернулись; карточки и кнопки на телефоне — 2.1, 2.2, 2.4–2.6;
  - отметка «забыл открыть», потом смена на «Себептүү», потом «Снять» — цифры и статусы меняются без перезагрузки — 2.8–2.12, 2.14;
  - у проведённого урока кнопки нет — 2.13;
  - «Көңүл буруу керек» и чипы в журнале — 2.16–2.19;
  - плитка на главной — 2.20;
  - порог 10 на `/timeslots` → опоздание у урока с опозданием 12 мин, затем вернуть 15 — 2.22, 2.23.
- **dean:** видит только «Хафиздик бөлүмү» — 1.15; ставит и снимает отметку своему учителю — 2.24; нет пункта «Иш эмес күндөр», переход на `/non-working-days` уводит — 2.26; нет `/timeslots` — 2.27; API-запрос отметки учителю «Илим бөлүмү» → 403 — 2.25, 1.16.
- **teacher:** нет «Мониторинга», `/monitoring` → `/schedule`, API `/monitoring/*`, `/dashboard/*`, `/non-working-days`, `/settings`, `/monitoring/lesson-marks` → 403 — 1.17, 2.29; урок в «Менин классым» открывается как раньше — 2.30.
- **hafiz:** хафиз-журнал открывается как раньше — 2.30; хафиз-урок с записями хифза не помечен «Студенттер белгиленген эмес» в мониторинге ректора — 2.21.
- Тесты, которые меняют общие данные (нерабочий день, отметка, порог), сами возвращают всё обратно и идут последовательно (`test.describe.serial`).

### Сверка критериев

| Критерии | Где покрыто |
|---|---|
| 1.1–1.3, 1.9 | `_occurrences` п. 3; pytest; e2e (1.1) |
| 1.4, 1.5 | период ∩ семестр; `periodOutsideSemester` во фронтенде |
| 1.6–1.8 | `conducted_percent`, сортировка; `TeacherMonitoringPage`, `percentColor` |
| 1.10 | сетка плиток на телефоне; e2e 375 px |
| 1.11–1.13 | общий `_occurrences`, поля сводки; `DashboardPage` |
| 1.14 | `student_attendance_summary` |
| 1.15–1.17 | `department_scope`, `require_role`; pytest прав; e2e dean/teacher |
| 2.1–2.7 | `non_working_days` (модель, API, страница, меню) |
| 2.8–2.15, 2.24, 2.25, 2.28 | `lesson_marks`, `validate_mark_target`, `LessonMarkDialog` |
| 2.16–2.21 | флаги внимания, колонка и плитка |
| 2.22, 2.23, 2.27 | `app_settings`, `LateThresholdCard` |
| 2.26, 2.29 | роли на новых адресах, `RoleRoute`, `Layout` |
| 2.30 | `journal.get_or_create_session` не меняется; тест на нерабочий день |

## Риски

- **Производительность.** Период «Год» — это до ~40 дат × N записей в памяти, это дёшево. Запросов в `_occurrences` фиксированное число (записи с `selectinload`, уроки, отметки, нерабочие дни, посещаемость без освобождений, хифз по группам, замены, учителя, порог). Сейчас `entry.time_slot` грузится лениво — это N+1, исправляется тем же `selectinload`. Индексы: `uq_session_entry_date`, `uq_lesson_mark_entry_date`, `uq_attendance_session_student` (ведущий `session_id`) покрывают выборки. `hifz_records` по дате без индекса; при текущем объёме это допустимо, при росте — отдельный индекс.
- **Безопасность.** Декан без отделения сейчас видит мониторинг всего медресе — закрываем через `department_scope`. Тот же шаблон остался в `/dashboard/workload` и `/dashboard/unassigned-subjects`, они вне рамок фичи; стоит отдельной задачей перевести и их. Права на отметку проверяются по учителю, отвечавшему за урок в эту дату, а не по текущему.
- **Обратная совместимость.** Бэкенд выкатывается раньше фронтенда, поэтому ответы только расширяются. Старый фронтенд сам считает «Успеваемость» (с опозданиями) и использует `top_missed` — до выхода тега это продолжит работать. Учесть в описании релиза, что цифры в старом интерфейсе уже будут по новым правилам.
- **Цифры в проде изменятся сразу после выката шага 1:** пропуски вне семестра и за идущие пары исчезнут, проценты появятся. Это ожидаемое поведение, но ректора нужно предупредить: при сравнении со старыми выгрузками «пропусков стало меньше» — не ошибка.
- **«Требует внимания» в проде** сразу покажет все прошлые уроки без отметок посещаемости, в том числе до появления журнала. Процент от этого не меняется (вопрос 4), но цифра может удивить ректора — упомянуть в документации (docs).
- **Перенос записи расписания на другой день** (PATCH `/schedule/{id}`) оставляет старые отметки на датах, которые больше не совпадают с днём недели. Они не считаются, но лежат в таблице. Так же сейчас ведут себя уроки. Отдельно не чистим; при необходимости — отдельная задача.
- **Миграция:** только новые таблицы, данные не теряются; enum в Postgres удаляется вручную в `downgrade`. Проверять только на локальном Postgres, Neon при разработке не трогать.
- **Стенд e2e.** В `seed.py` пара 1 идёт 00:00–23:59, а прошлые уроки закрыты примерно в 10:16 — раньше середины этой пары. Все такие уроки получат «Завершён до середины пары». Предложение: в `seed.py` закрывать уроки пары 1 по концу пары (как автозакрытие), а уроки на парах 2–3 оставить как есть. Это меняет только время закрытия в журнале по дням; видео перед следующей записью стоит пересмотреть. Даты семестра на стенде фиксированы (01.09–31.12.2026): после 31.12.2026 мониторинг на стенде станет пустым — заметка для qa.
- **Сортировка по ФИО** через `casefold()` не знает кыргызского алфавита (ң, ө, ү окажутся после я). Она нужна только чтобы разрешать равенство процентов и пропусков, это приемлемо.
- **Религиозный контент:** нет. Названия праздников вводит ректор как обычные данные, толкований в интерфейсе нет; пометка не требуется.

## Порядок работы

**Шаг 1 спеки — подсчёт** (без миграции; после п. 4 шаг 1 готов и проверяем целиком):

1. `core/deps.py::department_scope` и перевод на него `/monitoring/*` и двух эндпоинтов мониторинга на `/dashboard/*`; 404 на неизвестный семестр. Тесты прав из «pytest — права шага 1». → `pytest -q` зелёный.
2. `services/monitoring.py`: `now_bishkek`, параметр `now` вместо `today`, `_occurrences` с пунктами 1–3 и 7 правил (без нерабочих дней и отметок), `selectinload`, процент, сортировка, `lowest_percent`, обрезка в `student_attendance_summary`. Перевести существующие тесты на `now=`, добавить тесты шага 1 и тест на число запросов. → `pytest -q` зелёный.
3. `schemas/monitoring.py` и `response_model` в роутерах; новые поля (`conducted_percent`, `lowest_percent`, `status`, `schedule_entry_id`); HTTP-тест 1.9 с подменой `now_bishkek`. → `pytest -q` зелёный.
4. Фронтенд шага 1: `types.ts`, `lib/monitoring.ts`, колонка «Өткөрүлгөн %», сообщение «вне семестра», плитка процента и список «Эң төмөн көрсөткүч» на главной, ключи i18n в трёх файлах. → `npm run lint && npm run build` зелёные, `pytest -q` зелёный. Ручная проверка на 375 px. **Здесь шаг 1 готов к ревью.**

**Шаг 2 спеки — причины:**

5. Модели `NonWorkingDay`, `LessonMark`, `AppSettings`, enum `LessonMarkKind`; одна миграция; `upgrade → downgrade -1 → upgrade` на локальном Postgres. → `pytest -q` зелёный (create_all видит новые таблицы).
6. `services/settings.py`, `/settings`, порог в `_is_late`; `test_settings.py`. → `pytest -q` зелёный.
7. `/non-working-days` и пункт 4 правил в `_occurrences`; `test_non_working_days.py`. → `pytest -q` зелёный.
8. Отметки: пункты 5–6 правил, `validate_mark_target`, PUT/DELETE `/monitoring/lesson-marks`, `mark` и `can_mark` в журнале, удаление отметок вместе с записью расписания; `test_lesson_marks.py`. → `pytest -q` зелёный.
9. Флаги «требует внимания» (`no_student_marks`, `early_finish`, хифз), `attention_lessons` в строках и сводке; тесты 2.17–2.21. → `pytest -q` зелёный.
10. Фронтенд шага 2:
    - пропсы `EntityCrudPage` и `NonWorkingDaysPage`, маршрут и меню;
    - `LateThresholdCard` на `/timeslots`;
    - `LessonMarkDialog`, статусы, причины и чипы в журнале по дням;
    - колонка, плитка и плитка на главной «Көңүл буруу керек»;
    - i18n в трёх файлах.

    → `npm run lint && npm run build` зелёные, `pytest -q` зелёный.
11. Правка `e2e/fixtures/seed.py` (закрытие уроков пары 1 по концу пары), локальный прогон существующих e2e (`npx playwright test`), чтобы старые сценарии не сломались. → всё зелёное, передать reviewer.
