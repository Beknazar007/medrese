# Конвейер видеоуроков

Сценарий `videos/scenarios/<feature>.md` → запись экрана (Playwright) → озвучка (edge-tts) → склейка с субтитрами (ffmpeg).
Запись идёт только на локальном стенде с выдуманными людьми (`e2e/fixtures/seed.py`). Прод не записывать никогда — там реальные имена учеников.

## Установка (один раз)

```bash
# бэкенд должен стоять в обычном python: стенд запускается им (cd backend && pip install -e ".[dev]")
cd frontend && npm install && cd ..
python -m venv videos/tools/.venv
videos/tools/.venv/Scripts/python -m pip install -r videos/tools/requirements.txt   # Linux/macOS: .venv/bin/python
videos/tools/.venv/Scripts/python -m playwright install chromium
```

ffmpeg ставить не нужно: если его нет в PATH, `static-ffmpeg` при первом запуске скачает готовую сборку.

## Запись

```bash
videos/tools/.venv/Scripts/python videos/tools/make_video.py videos/scenarios/login.md            # ky и ru, все роли
videos/tools/.venv/Scripts/python videos/tools/make_video.py videos/scenarios/login.md --lang ru  # только русский
```

Скрипт сам поднимает стенд (бэкенд :8767 на свежей SQLite, фронтенд :5177) и гасит его в конце.
`PYTHON=...` — каким python запускать бэкенд стенда, если не `python`.

Результат в `videos/output/<feature>/`:

| файл | что это |
|---|---|
| `<role>-<lang>.mp4` | видео H.264 + AAC, субтитры вшиты отдельной дорожкой (включаются в плеере) |
| `<role>-<lang>.srt` | те же субтитры файлом — для YouTube/Telegram |
| `frames/<role>-<lang>-{start,middle,end}.png` | три кадра для проверки, что на видео нужный экран, а не ошибка |
| `manifest.json` | по каждому видео: длительность, голос, хэш сценария, версия приложения, `religious_review`, `native_speaker_review` |

Видео и кадры в git не попадают (`.gitignore`), `.srt` и `manifest.json` — попадают.

## Голоса — `voices.json`

Для каждого языка два варианта: **ElevenLabs** (платный, модель `eleven_v3` говорит по-кыргызски) и **edge-tts** (бесплатный запасной).
ElevenLabs включается для языка, когда в `.env` есть `ELEVENLABS_API_KEY`, а в `voices.json` у этого языка заполнен `elevenlabs.voice_id`
(ID голоса — в библиотеке голосов ElevenLabs, кнопка «Copy voice ID»). Иначе — edge-tts:

| язык | edge-tts | заметка |
|---|---|---|
| ru | `ru-RU-SvetlanaNeural` | |
| ky | `kk-KZ-AigulNeural` | **В edge-tts нет кыргызского голоса** — читает казахский голос, с акцентом. Поэтому для ky нужен ElevenLabs. |

Какой голос записал видео — в `manifest.json` (`voice`). Каждое ky-видео всё равно проверяет носитель языка.
Расход ElevenLabs — по символам озвучки: одно видео на ~40 с ≈ 300 символов на язык.

## Формат сценария

См. `videos/scenarios/_template.md`. Главное: `@ключ.i18n` в локаторах (`role=button[name="@login.submit"]`) подставляет текст на языке видео, поэтому один сценарий пишет и ky, и ru.

## Публикация

Площадка — **Telegram-канал**. Публикует бот, который добавлен в канал администратором с правом публиковать.

В `.env` (не в git):
```
TELEGRAM_BOT_TOKEN=<токен от @BotFather>
TELEGRAM_CHANNEL_ID=@имя_канала        # или -100… для закрытого канала
```

```bash
videos/tools/.venv/Scripts/python videos/tools/publish_telegram.py          # пробный прогон: что и с какой подписью уйдёт
videos/tools/.venv/Scripts/python videos/tools/publish_telegram.py --send   # отправить
```

Уходят только записи реестра со `status: "draft"`, `"approved": true` и `religious_review` не `required`. Подпись к видео:
название из сценария, язык, роль, версия, «Что нового» из секции `CHANGELOG.md` этой версии и `comment` записи
(комментарий пишет человек при одобрении или publisher по его словам). После отправки скрипт ставит
`status: "published"`, `published_url`, `published_at`, а видео из `replaces` — `outdated`.
Лимит подписи в Telegram — 1024 символа, длинное обрезается.
