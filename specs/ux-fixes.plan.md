# План: Исправление недочётов B1–B6 (+ замена преподавателя B5.R1–R6)
Спека: specs/ux-fixes.md · Ветка: feature/ux-fixes

## Решение

- **B1** — в основном фронтенд: `ScheduleGridPage` запрашивает `GET /assignments` и для учителя (сервер уже отдаёт только его назначения). Для крит. 4 (предмет или группа другой кафедры) сервер расширяет `GET /subjects` и `GET /groups` для TEACHER: своя кафедра **плюс** предметы и группы его назначений. Вариант «добавить `subject_name`/`group_name` в ответ расписания» отброшен: он чинит только `/schedule`, а `nameById` по справочникам используется и в других местах учителя.
- **B2–B4** — общий компонент `EntityCrudPage`: обязательные поля проверяются до вопроса «Сохранить?», ошибки показываются у поля. Нетронутый переключатель отправляется так, как показан (`Boolean(value)`). Пустое число хранится как `""`, а не `0`. `apiErrorMessage` переводит ошибки 422 по `type` и `loc`. На сервере `null` в часах предмета превращается в 0, `null` в `is_active` — в значение по умолчанию: фронтенд не единственный клиент, и `PATCH` с `null` сейчас даёт 500.
- **B5** — новый `PATCH /assignments/{id}`. Предмет и вид часов меняются всегда. Если назначение уже в расписании, группу и семестр сменить нельзя (409). Преподаватель меняется с проверкой накладок по всем записям расписания этого назначения. Записи расписания **не пересоздаются**: на них ссылаются проведённые уроки. В них обновляется копия `teacher_id`.
- **История при замене (B5.R3).** Сейчас у проведённого урока (`lesson_sessions`) нет своего преподавателя: мониторинг берёт его из `schedule_entries.teacher_id`, история ученика и доступ к журналу — из `teaching_assignments.teacher_id`. Если просто переписать эти поля, вся история «переедет» к новому учителю. Поэтому:
  1. в `lesson_sessions` добавляется колонка `teacher_id` — кто фактически провёл урок; она ставится при открытии урока, для старых уроков переносится миграцией;
  2. новая таблица `assignment_teacher_changes` — журнал замен с датой начала действия. По ней мониторинг относит **непроведённые** прошлые уроки к прежнему преподавателю.

  Отброшенный вариант — «разделить назначение на два с датами действия у записей расписания». Его не дают сделать уникальные ограничения расписания (группа и пара), и он требует переписать весь журнал.
- **B6** — `Layout.tsx` показывает Snackbar `password.changed` в `onChanged` у единственного `ChangePasswordDialog`.
- **Вопрос 4 (хафиз-группы в `/schedule`) — да, у них есть уроки в обычном расписании.** Хафиз-урок — это обычные `TeachingAssignment` и `ScheduleEntry` с группой `group_type=HAFIZ`. Хифз-журнал открывает урок по `schedule_entry_id` (`api/v1/hifz.py`, `POST /hifz/sessions`), а обычный журнал такой урок не открывает и отправляет в хифз-журнал. Значит, B1 меняет расписание хафиз-учителя так же, как обычного учителя. Следствие для B5.R4: доступ к хафиз-группе (`hifz_service.teacher_hifz_group_ids`) определяется текущими назначениями, поэтому после замены хифз-журнал группы переходит к новому преподавателю.

## Модель данных и миграции

Миграция **нужна** только для замены преподавателя (B5.R3). Остальные пункты B1–B6 схему не меняют. Одна ревизия Alembic, `down_revision = 'c5d2f8a1e347'` (текущая голова), имя файла `…_teacher_replacement_history.py`.

1. **`lesson_sessions.teacher_id`** — `ForeignKey("teacher_profiles.id")`.
   - upgrade: добавить колонку как nullable; заполнить значением `schedule_entries.teacher_id` через связанный подзапрос `sa.update(lesson_sessions).values(teacher_id=sa.select(schedule_entries.c.teacher_id).where(...).scalar_subquery())` (выражения SQLAlchemy по `sa.table(...)`, без текстового SQL); затем `alter_column(nullable=False)`; индекс `ix_lesson_sessions_teacher_id_date (teacher_id, date)`.
   - Модель: `teacher_id: Mapped[int] = mapped_column(ForeignKey(...), nullable=False)`, `teacher: relationship()`.
   - Перенос в проде без потерь: пока замен не было, `schedule_entries.teacher_id` — это и есть тот, кто вёл урок.
2. **Таблица `assignment_teacher_changes`** (модель `AssignmentTeacherChange`, файл `models/assignment_teacher_change.py`):
   `id` PK; `assignment_id` FK → `teaching_assignments.id` `ondelete="CASCADE"`, индекс; `from_teacher_id` FK → `teacher_profiles.id` NOT NULL; `to_teacher_id` FK → `teacher_profiles.id` NOT NULL; `effective_from` Date NOT NULL (с этого дня, по Бишкеку, отвечает новый); `changed_by_user_id` FK → `users.id` `ondelete="SET NULL"`, nullable; `created_at` timestamptz `server_default=now()`.
   На `TeachingAssignment` — `teacher_changes: relationship(cascade="all, delete-orphan", order_by=effective_from)`, чтобы удаление назначения не упиралось в журнал замен.
   Записи журнала создаются только при замене у назначения, у которого есть записи расписания. Без расписания истории нет и записывать нечего.
3. **downgrade:** `drop_table("assignment_teacher_changes")`, `drop_index`, `drop_column("lesson_sessions", "teacher_id")`. При откате пропадает только разметка «кто вёл» для уроков после замен. Отчёты вернутся к старому поведению «всё за текущим преподавателем», уроки и посещаемость не теряются.
4. Автогенерацию прочитать и поправить руками (CLAUDE.md). Проверить локально на Postgres: `alembic upgrade head` → `downgrade -1` → `upgrade head`.

## API

| Метод и путь | Роли | Запрос | Ответ | Ошибки |
|---|---|---|---|---|
| `PATCH /api/v1/assignments/{id}` (**новый**) | `require_role(RECTOR, DEAN)`. **Ректор** — любое назначение. **Декан** — `assert_department_access` для кафедры **текущего** преподавателя назначения, а также для кафедр **итоговых** преподавателя, предмета и группы (как при создании). **Декан чужой кафедры** → 403. **Учитель** (в том числе хафиз) → 403 из `require_role` | `TeachingAssignmentUpdate`: `teacher_id`, `subject_id`, `group_id`, `semester_id`, `hour_type` — все необязательные; `null` или отсутствие поля = не менять | 200 `TeachingAssignmentOut` | 404 `Assignment not found` / `Teacher not found` / `Subject not found` / `Group not found` / `Semester not found`; 403 `You do not have access to this department`; 409 `This teacher is already assigned to this subject/group/semester/hour type` (дубль, крит. 29); 409 `Cannot change the group or semester of an assignment that is in the timetable` (крит. 28); 409 `The new teacher already has classes at: 1/2, 3/4` (`<day_of_week>/<номер пары>` через «, », B5.R2); 400 `The new teacher must be from the same department as the assignment` (B5.R6, только ректор: декана раньше остановит 403); 409 `This slot is already booked` (гонка, сработало уникальное ограничение расписания) |
| `GET /api/v1/assignments` | без изменений (учитель — только свои; без профиля — `[]`) | — | — | закрепить тестом (крит. 5) |
| `GET /api/v1/subjects`, `GET /api/v1/groups` | TEACHER: своя кафедра **или** `id` из его назначений (`or_(… .in_(dept_ids), Subject.id.in_(select(TeachingAssignment.subject_id).where(TeachingAssignment.teacher_id == profile.id)))`). Ректор и декан — без изменений | — | — | — |
| `POST /api/v1/subjects`, `PATCH /api/v1/subjects/{id}` | без изменений | часы: `null` → 0; `ge=0` | — | 422 при отрицательном числе (крит. 18) |
| `POST /api/v1/semesters` | без изменений (только RECTOR) | `is_active: null` → `False` | — | 403 декану и учителю (крит. 23) |
| `POST /api/v1/students` | без изменений | `is_active: null` → `True` | — | — |

**Алгоритм `PATCH /assignments/{id}`** (`api/v1/assignments.py`, логика замены — в `services/assignments.py`):
1. Загрузить назначение (404), выполнить `assert_department_access(user, assignment.teacher.department_id)`.
2. Посчитать итоговые значения: поле из payload, если оно не `None`, иначе текущее. Загрузить итоговых преподавателя, предмет, группу и семестр (404). Вызвать `assert_department_access` для кафедр преподавателя, предмета и группы.
3. `has_entries = exists(ScheduleEntry.assignment_id == id)`. Если `has_entries`, а группа или семестр изменились → 409.
4. Дубль: если существует другое назначение с той же пятёркой полей → 409 `teacher_already_assigned`. Проверка заранее даёт понятный ответ, а `IntegrityError` остаётся запасной защитой.
5. Если `has_entries` и сменился преподаватель:
   - если `new_teacher.department_id != old_teacher.department_id` → 400 (B5.R6). Так мониторинг кафедры и история остаются в одной кафедре;
   - накладки: **одним запросом** загрузить записи нового преподавателя в этом семестре (`selectinload(ScheduleEntry.time_slot)`), пересечь по `(day_of_week, time_slot_id)` с записями назначения; при пересечении → 409 со списком всех занятых `день/пара`, ничего не менять (B5.R2);
   - `update(ScheduleEntry).where(ScheduleEntry.assignment_id == id).values(teacher_id=new)`;
   - добавить `AssignmentTeacherChange(from, to, effective_from=сегодня по Asia/Bishkek, changed_by_user_id=user.id)`.
6. Присвоить поля назначению, выполнить `commit`. При `IntegrityError` — rollback и 409. Если сработало ограничение расписания, ответ `This slot is already booked`, иначе — дубль назначения.

**Кто отвечает за урок в дату d** (`services/assignments.py: responsible_teacher_id(entry, d, changes)`): если урок проведён — `lesson_session.teacher_id`. Иначе берётся журнал замен назначения, отсортированный по `effective_from`: первая замена с `d < effective_from` даёт её `from_teacher_id`; если такой нет — `entry.teacher_id`.

## Изменения по файлам

| Файл | Что сделать |
|---|---|
| `backend/alembic/versions/<rev>_teacher_replacement_history.py` | миграция из раздела выше |
| `backend/app/models/lesson_session.py` | `teacher_id` + `teacher` relationship |
| `backend/app/models/assignment_teacher_change.py` (новый), `models/__init__.py`, `models/assignment.py` | модель журнала замен, регистрация модели, `teacher_changes` relationship |
| `backend/app/schemas/assignment.py` | `TeachingAssignmentUpdate` (все поля `X \| None = None`) |
| `backend/app/schemas/subject.py` | часы: `Annotated[int, BeforeValidator(none→0), Field(ge=0)]` в Create и Update (образец — `BeforeValidator` в `schemas/hifz.py`) |
| `backend/app/schemas/semester.py` | `SemesterCreate.is_active`: `None → False` |
| `backend/app/schemas/student.py` | `StudentCreate.is_active`: `None → True` |
| `backend/app/api/v1/subjects.py` | `update_subject`: `model_dump(exclude_unset=True, exclude_none=True)` — `null` в NOT NULL `name` больше не даёт 500; часы уже приведены к 0. `list_subjects`: расширение для TEACHER |
| `backend/app/api/v1/groups.py` | `list_groups`: расширение для TEACHER |
| `backend/app/api/v1/assignments.py` | `update_assignment` (PATCH) по алгоритму выше |
| `backend/app/services/assignments.py` (новый) | `replace_teacher(...)`, `find_teacher_conflicts(...)`, `responsible_teacher_id(...)`, `today_bishkek()` |
| `backend/app/services/journal.py` | `get_or_create_session`: `LessonSession(..., teacher_id=schedule_entry.teacher_id)`. `student_history`: преподаватель и фильтр по `LessonSession.teacher_id` (join `TeacherProfile` по нему), а не по `TeachingAssignment.teacher_id` |
| `backend/app/services/monitoring.py` | `teacher_monitoring`: загрузить журнал замен для назначений одним запросом и относить каждую ожидаемую дату к `responsible_teacher_id`; проведённый урок — к `session.teacher_id` (нужны `teacher_id` в выборке `held_rows`). `teacher_session_log`: записи, где `teacher_id == tid` **или** назначение есть в журнале замен с `from/to == tid`; оставлять даты, где отвечает `tid`. Фильтр кафедры — как сейчас (замена только внутри кафедры) |
| `backend/app/api/v1/journal.py`, `hifz.py` | без изменений логики доступа: доступ по текущему `assignment.teacher_id` и есть B5.R4 |
| `backend/tests/conftest.py` | фикстура `client_as(user)`: `TestClient(app)` с `dependency_overrides[get_db]` на тестовую сессию и `[get_current_user]` на пользователя (в проекте пока нет тестов уровня HTTP; `httpx` уже в dev-зависимостях). Нужна, чтобы проверить `require_role` → 403 |
| `backend/tests/factories.py` | `make_rector`, `make_dean(db, department)` (с `head_user_id`), `make_session(db, entry, date, teacher_id=None)` |
| `backend/tests/test_assignments.py`, `test_teacher_replacement.py`, `test_subjects.py`, `test_semesters.py` (дописать), `test_students_create.py`, `test_reference_lists.py` | см. «Тесты» |
| `frontend/src/api/entities.ts` | `assignmentsApi.update(id, payload)` → `PATCH /assignments/{id}` |
| `frontend/src/lib/errors.ts` | `apiErrorMessage(error, fallback, t, fieldLabels?: Record<string,string>)`. Для массива 422: из каждого элемента взять `loc` (последний строковый элемент — имя поля) и `type`; текст: сначала `translateDetail(msg)` (сохраняет `errors.*`, крит. 13), затем таблица `type → validation.*`, иначе `validation.generic`; при известной подписи поля — `validation.field_message` с `{field, message}`; повторы убрать. Типы: `missing → required`; `int_parsing/int_type/int_from_float → int`; `float_parsing/float_type → number`; `date_parsing/date_type/date_from_datetime_parsing → date`; `time_parsing/time_type → time`; `bool_parsing/bool_type → bool`; `enum/literal_error → choice`; `greater_than(_equal)/less_than(_equal) → range`; `string_too_short → too_short`; `string_too_long → too_long`. Новые точные сообщения: `assignment_scheduled_fields`, `new_teacher_other_department`; шаблон `^The new teacher already has classes at: (.+)$` → `errors.new_teacher_busy` с `{{slots}}`, где каждое `d/n` выводится как `t("days.d")`, `n` + `schedule.period_suffix` (или существующий ключ пары — developer найдёт; иначе новый). Для этого `Translate` принимает второй аргумент `options` |
| `frontend/src/components/EntityCrudPage.tsx` | (1) `fieldErrors` state; `validateRequired()` до `confirm` — пустое (`""`/`undefined`/`null`) обязательное поле → `validation.required`, `TextField`/`Autocomplete` получают `error` + `helperText`; при ошибке не спрашивать и не отправлять, окно не закрывать (крит. 9, 10). Ошибка поля сбрасывается при его изменении. (2) Число: `onChange` → `e.target.value === "" ? "" : Number(...)`. (3) Payload: checkbox → `Boolean(raw)` (крит. 22); остальное как сейчас. (4) Ошибки сервера → `apiErrorMessage(err, …, t, labelsFromFields)`. (5) Новый проп `confirmMessage?: (values, editingRow) => string \| undefined` — дополнительный текст в вопросе подтверждения (B5.R5). Цвета — только `error` из темы |
| `frontend/src/pages/AssignmentsPage.tsx` | `api.update`, `canEdit={canWrite}`; `defaultValues={{ semester_id: semesterId \|\| activeSemester?.id }}` (крит. 24, 25); `confirmMessage`: при редактировании, если `teacher_id` изменён → `assignments.teacher_replace_warning`. Флаг «назначение в расписании» во фронтенд не передаётся: предупреждение верно и без уроков, а ограничение на группу и семестр проверяет сервер |
| `frontend/src/pages/StudentsPage.tsx` | `defaultValues` с `is_active: true` (крит. 21; объединить с имеющимися, если они есть) |
| `frontend/src/pages/SemestersPage.tsx` | ничего, кроме того, что даёт общий компонент (нетронутый = `false`) |
| `frontend/src/pages/ScheduleGridPage.tsx` | запрос назначений: `enabled: (canWrite && Boolean(effectiveSemesterId)) \|\| user?.role === "TEACHER"`; у учителя без семестра — без `semester_id` (крит. 8). Ключ запроса не менять |
| `frontend/src/Layout.tsx` | `const [pwdChanged, setPwdChanged]`; `onChanged={() => { dismissBanner(); setPwdChanged(true); }}`; `<Snackbar autoHideDuration={4000} message={t("password.changed")} />` (крит. 33–36) |
| `frontend/src/i18n/locales/{ky,ru,en}.json` | ключи ниже |

**Ключи i18n** (тексты из таблицы спеки): `validation.required`, `validation.int`, `validation.number`, `validation.date`, `validation.time`, `validation.bool`, `validation.choice`, `validation.range`, `validation.too_short`, `validation.too_long`, `validation.generic`, `validation.field_message` (`{{field}}: {{message}}`); `assignments.teacher_replace_warning` (ky «Мугалим бардык келечектеги сабактарда алмашат», ru «Преподаватель будет заменён во всех будущих уроках», en «The teacher will be replaced in all upcoming lessons»); `errors.assignment_scheduled_fields` — **текст из спеки без «преподавателя»**, потому что по решению по вопросу 1 его менять можно (ky «Бул дайындоо жадыбалда турат — топту же семестрди алмаштыруу үчүн адегенде аны жадыбалдан алып салыңыз», ru «Это назначение уже стоит в расписании — чтобы сменить группу или семестр, сначала уберите его из расписания», en «This assignment is already in the timetable — remove it from the timetable first to change the group or semester»); `errors.new_teacher_busy` (ky «Жаңы мугалим бул убакта бош эмес: {{slots}}», ru «Новый преподаватель в это время занят: {{slots}}», en «The new teacher is busy at: {{slots}}»); `errors.new_teacher_other_department` (ky «Жаңы мугалим ушул кафедрадан болушу керек», ru «Новый преподаватель должен быть с той же кафедры», en «The new teacher must be from the same department»). Кыргызские формулировки, которых нет в спеке, проверить носителю (pm или человек), но это не блокирует работу.

## Тесты

**pytest.** Права на HTTP-уровне проверяются через `client_as`, остальное — вызовом сервисов.

`test_assignments.py`
- `test_teacher_lists_only_own_assignments` — с `semester_id` и без; нет чужих (крит. 5).
- `test_teacher_without_profile_gets_empty_list` (крит. 5).
- `test_teacher_cannot_create_update_delete_assignment` — POST, PATCH и DELETE → 403, в том числе для хафиз-учителя (крит. 6, 31).
- `test_rector_updates_all_fields_of_unscheduled_assignment` → 200, все пять полей изменились (крит. 27).
- `test_dean_updates_own_department_assignment` → 200.
- `test_dean_cannot_update_other_department_assignment` → 403 (крит. 30).
- `test_dean_cannot_move_assignment_to_other_department_teacher_subject_or_group` — три подслучая → 403 (крит. 30, B5.R6).
- `test_scheduled_assignment_subject_and_hour_type_can_change` → 200; запись расписания та же (`id`), её `assignment_id` указывает на назначение с новым предметом (крит. 28).
- `test_scheduled_assignment_group_change_is_409` и `…_semester_change_is_409` — detail точный, данные не изменились (крит. 28).
- `test_update_to_duplicate_is_409` (крит. 29).
- `test_update_missing_assignment_is_404`; `test_update_to_missing_teacher_is_404`.
- `test_create_and_delete_still_work` (крит. 32).

`test_teacher_replacement.py`
- `test_rector_replaces_teacher_in_all_schedule_entries` — у всех записей `teacher_id = new`, есть строка в `assignment_teacher_changes` с `effective_from = сегодня` (B5.R1).
- `test_replacement_conflict_is_409_and_changes_nothing` — у нового преподавателя занята пара; detail содержит `день/пара`; записи и журнал не изменились (B5.R2).
- `test_replacement_lists_every_conflicting_slot` — две занятые пары → обе в detail.
- `test_dean_replaces_teacher_within_own_department` → 200; `test_dean_cannot_replace_with_other_department_teacher` → 403; `test_rector_cannot_replace_with_other_department_teacher_on_scheduled_assignment` → 400 (B5.R6).
- `test_held_sessions_keep_previous_teacher` — `lesson_session.teacher_id` прежний; `student_history` показывает прежнего; фильтр `teacher_id=old` возвращает урок (B5.R3).
- `test_monitoring_attributes_past_lessons_to_previous_teacher` — до `effective_from` проведённые и пропущенные уроки за старым, с этой даты — за новым; `teacher_session_log` для обоих (B5.R3).
- `test_new_teacher_sees_entries_and_can_open_journal_old_cannot` — `GET /schedule` от нового и от старого; `_assert_can_access_entry` для старого → 403 (B5.R4).
- `test_new_session_is_stamped_with_entry_teacher` — `get_or_create_session` записывает `teacher_id`.
- `test_unscheduled_teacher_change_writes_no_history`.

`test_subjects.py`
- `test_create_subject_with_null_or_missing_hours_defaults_to_zero` (крит. 17, 14, 15).
- `test_patch_subject_null_practice_hours_sets_zero` (крит. 16, 17).
- `test_negative_hours_rejected` — 422 при `ge=0` (крит. 18).
- `test_patch_subject_null_name_is_ignored` — не 500.

`test_semesters.py` (дописать)
- `test_create_semester_without_or_with_null_is_active_is_inactive_and_keeps_current_active` (крит. 19).
- `test_create_active_semester_deactivates_others` (крит. 20).
- `test_dean_and_teacher_get_403_on_semester_writes` (крит. 23).

`test_students_create.py` — `test_create_student_with_null_is_active_is_active` (крит. 21).

`test_reference_lists.py` — `test_teacher_sees_other_department_subject_and_group_of_own_assignment_only` — чужие предметы и группы без его назначений не видны (крит. 4); `test_rector_and_dean_lists_unchanged`.

**e2e** (qa, `e2e/tests/ux-fixes/<role>.spec.ts`):
- teacher: 390×844 и ≥900 — название предмета в карточке и в окне урока; предмет другой кафедры; без активного семестра (крит. 1–4, 8). Кнопок изменения нет (крит. 6).
- rector:
  - семестр с пустой датой → подсветка, нет вопроса «Сохранить?» и нет запроса (крит. 9); пустые выбор и число (крит. 10);
  - сообщение 422 без английского при ky и ru (крит. 11, 12) — спровоцировать отрицательными часами;
  - предмет только с лекцией (крит. 14–16); семестр без переключателя (крит. 19, 20); студент активен по умолчанию (крит. 21);
  - назначение: семестр по умолчанию и из фильтра (крит. 24, 25); «Изменить» на телефоне и компьютере (крит. 26); изменение без расписания (крит. 27); в расписании — смена предмета видна в `/schedule`, смена группы → сообщение (крит. 28); дубль (крит. 29);
  - замена преподавателя: предупреждение (B5.R5), уроки у нового (B5.R1, R4), накладка → сообщение с днём и парой (B5.R2).
- dean: в списках формы назначения только своя кафедра (крит. 30); нет страницы «Семестры» (крит. 23).
- все роли: «Пароль изменён» из меню, шапки и баннера; при ошибке его нет; баннер скрыт (крит. 33–36).
- переключение языка без перезагрузки (крит. 37); ночная тема — подсветка ошибок (крит. 38).

**Сверка критериев:** 1–3, 8 — `ScheduleGridPage`; 4 — списки предметов и групп; 5–7 — тесты и PATCH 403; 9–13 — `EntityCrudPage` и `errors.ts`; 14–18 — `schemas/subject` и фронтенд; 19–23 — `schemas/semester`, `schemas/student`, checkbox, `StudentsPage`; 24–32 и B5.R1–R6 — PATCH, сервис, миграция, `AssignmentsPage`; 33–36 — `Layout`; 37–38 — i18n и тема; 39 — тесты выше.

## Риски

- **Противоречие в спеке:** крит. 28 и строка i18n «B5: назначение в расписании» ещё запрещают менять преподавателя. По решению по вопросу 1 действуют B5.R1–R6, и план следует им: текст ошибки без «преподавателя». pm стоит поправить крит. 28 в спеке, но работе это не мешает.
- **Граница дня замены.** `effective_from` = сегодня. Урок, проведённый сегодня до замены, остаётся за прежним (по `session.teacher_id`). А **непроведённый** сегодняшний урок, пара которого уже прошла, засчитается новому как пропуск. Случай редкий, на уровне погрешности; при необходимости сделать отдельно.
- **Доступ прежнего преподавателя:** после замены он теряет доступ к открытым урокам и журналу этого назначения, в том числе к хифз-журналу группы, если других назначений с ней у него нет. Это и есть B5.R4. Свою историю оценок он видит в профиле ученика, только пока у него есть доступ к группе.
- **Удаление прежнего преподавателя:** `lesson_sessions.teacher_id` (FK) не даст удалить преподавателя, который вёл уроки, даже без назначений. `delete_teacher` вернёт 409 с неточным текстом «still has teaching assignments». Данные защищены, текст можно уточнить позже.
- **Производительность:** накладки — один запрос; мониторинг — +1 запрос на журнал замен (`assignment_id IN (...)`), без N+1; индекс `(teacher_id, date)` на `lesson_sessions`. Фильтр в `GET /subjects` и `/groups` для учителя — подзапрос `IN`, индексы по FK есть.
- **Безопасность:** учитель видит только предметы и группы своих назначений из чужих кафедр; запись по-прежнему через `require_role`. В PATCH декан проверяется и по текущей, и по итоговой кафедре.
- **Прод:** миграция заполняет `teacher_id` у всех `lesson_sessions` одним UPDATE (таблица небольшая); NOT NULL ставится после заполнения. Запускать на Neon только после мержа, по обычной процедуре деплоя. Разработка и тесты — только на локальной базе.
- **Совместимость:** новые поля в ответах не добавляются; `LessonSessionOut` не меняется.
- **Таблица на компьютере:** кнопки там иконками с `aria-label`/`title` у всех справочников, в том числе «Удалить». «Изменить» будет таким же; подписанные крупные кнопки — на телефоне. Если нужны подписи и в таблице, это отдельная правка общего компонента для всех страниц.

## Порядок работы

1. Ветка `feature/ux-fixes`. В `conftest.py` добавить `client_as`, в `factories.py` — новые фабрики; написать тест списка назначений учителя (крит. 5). `pytest -q` зелёный.
2. B3 и B4 на сервере: схемы subject, semester, student, `exclude_none` в `update_subject`, тесты. Зелёные.
3. B1 на сервере: расширение `list_subjects` и `list_groups` для учителя, тесты. Зелёные.
4. Миграция и модели (`lesson_sessions.teacher_id`, `assignment_teacher_changes`); `get_or_create_session` ставит `teacher_id`. Проверить `alembic upgrade`/`downgrade` на локальном Postgres, `pytest` зелёный.
5. `PATCH /assignments/{id}` без замены преподавателя (права, 409 на группу и семестр, дубль) и тесты.
6. Замена преподавателя: `services/assignments.py`, накладки, журнал замен, тесты B5.R1–R6.
7. `student_history` и мониторинг (`teacher_monitoring`, `teacher_session_log`) на `session.teacher_id` и журнал замен; тесты истории и мониторинга, а также все старые (`test_monitoring`, `test_journal`, `test_hifz`) — зелёные.
8. Фронтенд: `errors.ts`, `EntityCrudPage` (проверка, числа, checkbox, `confirmMessage`), i18n в трёх файлах. `npm run lint && npm run build`.
9. Фронтенд: `AssignmentsPage` (update, семестр по умолчанию, предупреждение), `StudentsPage`, `ScheduleGridPage`, `Layout` (Snackbar пароля). Ручная проверка на 390×844 и ≥900, светлая и ночная тема. `lint` + `build` + `pytest`.
10. Обновить `pipeline/ux-fixes.json` и передать работу reviewer.
