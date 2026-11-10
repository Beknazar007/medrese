# Медресе — система управления учебным процессом

Веб-приложение (PWA) для медресе «Кутайба ибн Муслим»: расписание, журнал посещаемости и экзаменов, хафиз-журнал, освобождения, мониторинг учителей, отчёты. Интерфейс на кыргызском (основной), русском и английском. Подробный аудит: `docs/AUDIT.md`.

## Стек

- **Бэкенд:** Python 3.11+ (CI — 3.13), FastAPI, SQLAlchemy 2 (ORM, без сырого SQL), Alembic, Pydantic 2, JWT + bcrypt, openpyxl.
- **БД:** PostgreSQL 16 (прод — Neon), тесты — SQLite в памяти.
- **Фронтенд:** React 19 + TypeScript, Vite 8, MUI 9, TanStack Query 5, React Router 7, i18next, vite-plugin-pwa. Линтер — oxlint.
- **Прод сейчас:** бэкенд — Render, фронтенд — Cloudflare Pages, деплой из `main` после зелёного CI (`.github/workflows/ci.yml`).

## Структура

```
backend/app/api/v1/     роутеры по сущностям, router.py собирает /api/v1
backend/app/core/       config, deps (роли, доступ к кафедре), security (JWT, пароли)
backend/app/models/     модели SQLAlchemy        backend/app/schemas/   Pydantic-схемы
backend/app/services/   бизнес-логика (journal, hifz, excuses, monitoring, reports, workload)
backend/alembic/        миграции                 backend/tests/          pytest + factories.py
frontend/src/api/       axios-клиент, entities.ts (все вызовы API), types.ts
frontend/src/pages/     страницы (teacher/ — журналы учителя)
frontend/src/components/, context/, hooks/, lib/ (palette, attendance, dateRanges)
frontend/src/i18n/locales/{ky,ru,en}.json
specs/  reviews/  e2e/  docs/user-guide/  videos/   — артефакты агентов (см. ниже)
```

## Команды

```bash
docker compose up -d db                          # локальный Postgres
cd backend && pip install -e ".[dev]"
alembic upgrade head && python -m app.seed       # схема + первый ректор
uvicorn app.main:app --reload --port 8000
pytest -q                                        # тесты бэкенда (обязательно перед коммитом)

cd frontend && npm install && npm run dev        # http://localhost:5173
npm run lint && npm run build                    # проверка фронтенда (обязательно перед коммитом)

docker compose up -d --build                     # всё приложение в Docker: http://localhost:8080 (нужен .env)
cd e2e && npm ci && npx playwright test          # e2e на стенде с выдуманными людьми (сам поднимает бэкенд и фронтенд)
videos/tools/.venv/Scripts/python videos/tools/make_video.py videos/scenarios/<feature>.md   # видео (videos/tools/README.md)
```

**Деплой:** PR и `main` — только проверки (`ci.yml`); фронтенд на Cloudflare Pages выкатывается тегом `vX.Y.Z` (`deploy.yml`); бэкенд Render — сам после зелёного CI на `main`. Видео после релиза — вручную: Actions → «Post-release videos» (только запись, без публикации); публикация — `publish_telegram.py` после одобрения.

Новая миграция: `alembic revision --autogenerate -m "..."` — сгенерированный файл всегда читать и править руками.

## Роли пользователей

| Роль | Видит и делает |
|---|---|
| RECTOR | всё медресе: справочники, семестры, кабинеты, звонки, аккаунты, учителя, ученики, расписание, освобождения, мониторинг, отчёты; хафиз-журнал только читает |
| DEAN | то же в пределах своего отделения; не управляет семестрами, кабинетами, звонками, аккаунтами |
| TEACHER | своё расписание, журнал своих уроков (только во время урока), заметки об учениках |
| TEACHER с группой HAFIZ | хафиз-журнал: урок, оценки хифза/такрара, экзамены, цели |

Права проверяются на сервере (`core/deps.py`: `require_role`, `assert_department_access`, `accessible_department_ids`). Скрытие кнопок во фронтенде — не защита.

## Правила кода

- **Каждое изменение бэкенда — с тестом** в `backend/tests/`. Тесты и сборка фронтенда должны проходить до коммита.
- **Права доступа** — только через зависимости из `core/deps.py`; для каждого нового адреса явно решить, какие роли его видят.
- **Без сырого SQL**: запросы через ORM/выражения SQLAlchemy. Связи в списках загружать через `selectinload`, без N+1.
- **Часовой пояс** — `Asia/Bishkek`. Во фронтенде даты «сегодня» брать по местному времени, не через `toISOString()`.
- **Все тексты интерфейса — через i18n**, сразу в трёх файлах `ky.json`, `ru.json`, `en.json`. Кыргызский — основной язык.
- **Цвета** — из темы MUI и `lib/palette.ts` (работают в светлой и ночной теме), без hex в компонентах.
- **Телефон — главный экран учителя.** Кнопки изменения и удаления крупные и подписанные, не только иконки. Журналы сохраняются автоматически.
- **Комментарии объясняют «почему»**, а не пересказывают код.
- **Секреты** — только в `.env` (в git не попадает); `.env.example` без настоящих значений.
- **Никогда не писать в боевую базу** при разработке и тестах — только локальная или тестовая.
- **Git:** работа в отдельной ветке; коммит, пуш, мерж и релиз — только по явному указанию человека.

## Команда агентов (`.claude/agents/`)

Агенты связаны в цепочку командой `/pipeline <feature> [описание]` (`.claude/skills/pipeline/SKILL.md`) и файлом состояния `pipeline/<feature>.json`. Каждый агент читает этот файл в начале и дописывает в конце (что сделал, какие файлы, кто следующий); `/pipeline` по нему сам запускает следующего агента и останавливается только на ручных воротах. Субагент Claude Code не может вызвать другого субагента напрямую — поэтому переход делает главная сессия.

```
pm → [человек утверждает спеку] → architect → developer ⇄ reviewer (≤3 итерации)
   → qa → [человек мержит PR] → release → docs → video-scriptwriter → video-producer
   → [человек одобряет видео] → publisher
```

| Агент | Результат |
|---|---|
| pm | `specs/<feature>.md` — user stories по ролям, критерии приёмки, экраны |
| architect | `specs/<feature>.plan.md` — файлы, API, миграции, тесты |
| developer | код и тесты в ветке `feature/<feature>` |
| reviewer | `reviews/<feature>.md` — замечания или «одобрено» |
| qa | `e2e/tests/<feature>/<role>.spec.ts` + отчёт прогона |
| release | версия semver, `CHANGELOG.md`, тег `vX.Y.Z` (тег — после подтверждения человека) |
| docs | `docs/user-guide/<role>.md` |
| video-scriptwriter | `videos/scenarios/<feature>.md` — шаги + озвучка на кыргызском и русском |
| video-producer | `videos/output/<feature>/<lang>.mp4` + `.srt` |
| publisher | `videos/registry.json`; публикует в Telegram-канал только одобренные видео |

**Ручные ворота (агенты их не обходят):** утверждение спеки (`Статус: утверждено` в спеке ставит человек), мерж PR, одобрение видео (`"approved": true` в реестре ставит человек). Никаких автопубликаций.

**Религиозный контент.** Если фича, документация, сценарий или видео содержат аяты, хадисы, исламские термины с толкованием, правила чтения Корана и т. п., агент не публикует и не передаёт это дальше как готовое, а ставит пометку `⚠ ТРЕБУЕТ ПРОВЕРКИ УСТАЗОМ` рядом с фрагментом и в итоговом отчёте. Названия разделов интерфейса («хифз», «такрар», «джуз») пометки не требуют, их толкование — требует.
