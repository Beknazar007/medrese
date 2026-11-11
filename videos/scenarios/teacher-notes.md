# Видео: Как написать заметку об ученике и открыть его профиль
feature: teacher-notes · role: teacher · version: 0.0.0 · device: mobile
Длительность: ~60 с

## Шаги
```yaml
- id: 1
  action: login
  value: teacher
  pause: 1.0
  say: intro
- id: 2
  action: click
  target: role=button[name="@nav.menu"]
  pause: 0.6
- id: 3
  action: click
  target: role=link[name="@nav.my_class"]
  pause: 1.0
  say: open_class
- id: 4
  action: click
  target: tr:has-text("Бакиров Нурислам") >> role=button[name="@students.notes_title"]
  pause: 1.0
  say: icon
- id: 5
  action: highlight
  target: role=dialog >> text=Сабакта активдүү
  pause: 1.0
  say: earlier
- id: 6
  action: fill
  target: role=dialog >> label=@journal.note_body
  value: {ky: "Бүгүн сабакка жакшы даярданып келди.", ru: "Сегодня хорошо подготовился к уроку."}
  pause: 0.8
  say: write
- id: 7
  action: highlight
  target: role=dialog >> role=radiogroup
  pause: 1.0
  say: visibility
- id: 8
  action: click
  target: role=dialog >> role=button[name="@journal.note_add"]
  pause: 0.8
  say: add
- id: 9
  action: click
  target: role=dialog >> role=button[name="@common.yes"]
  pause: 1.0
- id: 10
  action: highlight
  target: {ky: "role=dialog >> text=Бүгүн сабакка жакшы", ru: "role=dialog >> text=Сегодня хорошо"}
  pause: 1.0
  say: saved
- id: 11
  action: click
  target: role=dialog >> role=button[name="@journal.close"]
  pause: 0.6
- id: 12
  action: click
  target: text=Бакиров Нурислам
  pause: 2.5
  say: profile
- id: 13
  action: highlight
  target: role=dialog
  pause: 2.0
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Бул видеодо окуучу тууралуу эскертме жазууну көрсөтөбүз. | Покажем, как написать заметку об ученике. |
| open_class | «Менин классым» бөлүмүн ачыңыз. | Откройте «Мой класс». |
| icon | Окуучунун жанындагы комментарий белгисин басыңыз. | Нажмите значок комментария рядом с учеником. |
| earlier | Мурунку эскертмелер ушул жерде көрүнөт. | Здесь видны прежние заметки. |
| write | Эскертмеңизди жазыңыз. | Напишите заметку. |
| visibility | Жеке эскертмени сиз гана көрөсүз. Жалпысын кафедра башчысы жана ректор да көрөт. | Личную видите только вы. Общую видят ещё завкафедрой и ректор. |
| add | «Кошуу» баскычын басып, ырастаңыз. | Нажмите «Добавить» и подтвердите. |
| saved | Эскертме сакталды. | Заметка сохранена. |
| profile | Окуучунун атын бассаңыз, анын профили ачылат. | Если нажать на имя ученика, откроется его профиль. |
| outro | Бул жерде анын маалыматы жана сабактарынын тарыхы бар. | Здесь его данные и история занятий. |

Данные: стенд `e2e/fixtures/seed.py` (у «Бакиров Нурислам» уже есть общая заметка), реальных имён нет.

Проверка носителем языка: требуется
