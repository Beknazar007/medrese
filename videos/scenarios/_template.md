# Видео: <задача пользователя глаголом — «Отметить посещаемость»>
feature: <feature> · role: <rector|dean|teacher|hafiz> · version: X.Y.Z · device: <mobile|desktop>
Длительность: ~90 с

<!--
ШАБЛОН. video-scriptwriter копирует его в videos/scenarios/<feature>.md.
Несколько ролей в одном файле: вместо «## Шаги» — секции «## Сценарий: <role>», в каждой своя
строка «device: …» и свой блок ```yaml; таблица «## Озвучка» одна на файл.

Действия (action):
  login      value: teacher|hafiz|dean|rector       — быстро войти учёткой стенда (обычно шаг 1)
  goto       target: /адрес                         — открыть страницу стенда
  click      target: <локатор>                      — нажать (элемент подсвечивается)
  fill       target: <локатор>, value: текст        — ввести текст по буквам
  select     target: <локатор>, value: вариант
  highlight  target: <локатор>                      — только подсветить
  wait       target: /адрес | <локатор>             — дождаться страницы или элемента
  press      value: Escape                          — нажать клавишу (закрыть меню)
  eval       target: show('sheet')                  — управлять нарисованным телефоном (device: slides,
                                                       videos/tools/slides/phone.html; пример — install-app.md)
Локаторы:
  label=<подпись поля>     role=button[name="<текст>"]     text=<видимый текст>
  в строке таблицы: tr:has-text("Асанов Эмир") >> role=button[name="@journal.attendance_absent"]
  в окне: role=dialog >> role=button[name="@common.yes"]
target и value могут быть разными для языков:  value: {ky: "Кыргызча текст", ru: "Русский текст"}
  @ключ.i18n вместо текста (@login.submit) — подставится текст на языке видео,
  поэтому один сценарий годится и для ky, и для ru. Текст из данных стенда пишется как есть.
pause — сколько секунд держать шаг; если реплика длиннее, шаг держится до её конца.
Каждый say должен быть строкой таблицы «Озвучка» с текстом на ky и ru.
-->

## Шаги
```yaml
- id: 1
  action: login
  value: teacher
  pause: 1.5
  say: s1
- id: 2
  action: click
  target: role=button[name="@nav.menu"]
  pause: 1.0
  say: s2
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| s1 | … | … |
| s2 | … | … |

Данные: стенд `e2e/fixtures/seed.py`, реальных имён нет.

<!-- Религиозный контент (аят, хадис, толкование, таджвид): не сочинять, у реплики пометка ⚠ ТРЕБУЕТ ПРОВЕРКИ УСТАЗОМ -->

Проверка носителем языка: требуется
