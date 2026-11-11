# Видео: Студенты — найти, посмотреть историю, добавить нового
feature: students · role: rector · version: 0.0.0 · device: desktop
Длительность: ~60 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- id: 2
  action: click
  target: role=link[name="@nav.students"]
  pause: 1.0
  say: open
- id: 3
  action: fill
  target: main >> input[placeholder^="@common.search"]
  value: Бакиров
  pause: 1.0
  say: search
- id: 4
  action: click
  target: text=Бакиров Нурислам
  pause: 1.5
  say: profile
- id: 5
  action: highlight
  target: role=dialog >> text=@students.notes_title
  pause: 1.2
  say: notes
- id: 6
  action: click
  target: role=dialog >> role=button[name="@common.close"]
  pause: 0.6
- id: 7
  action: click
  target: main >> role=button[name="@common.add"]
  pause: 1.0
  say: add
- id: 8
  action: fill
  target: role=dialog >> label=@students.full_name
  value: Турдубаев Эрмек
  pause: 0.5
  say: fill
- id: 9
  action: click
  target: role=dialog >> label=@students.group
  pause: 0.5
- id: 10
  action: click
  target: li:has-text("Кары 2")
  pause: 0.5
- id: 11
  action: fill
  target: role=dialog >> label=@students.guardian_phone
  value: "+996 555 00 00 00"
  pause: 0.8
  say: more
- id: 12
  action: click
  target: role=dialog >> role=button[name="@common.save"]
  pause: 0.6
  say: save
- id: 9c
  action: click
  target: role=dialog >> role=button[name="@common.yes"]
  pause: 1.5
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Студенттер тизмеси менен иштөөнү көрсөтөбүз. | Покажем, как работать со списком студентов. |
| open | Менюдан «Студенттер» бөлүмүн ачыңыз. | Откройте в меню «Студенты». |
| search | Издөө талаасына аты-жөнүн жазыңыз. | Впишите имя в поиск. |
| profile | Аты-жөнүн бассаңыз, ар бир сабак боюнча катышуу жана баалар ачылат. | Если нажать на имя, откроются посещаемость и оценки по каждому предмету. |
| notes | Төмөндө мугалимдердин жалпы комментарийлери. | Ниже — общие комментарии учителей. |
| add | Жаңы окуучу үчүн «Кошуу» баскычын басыңыз. | Для нового ученика нажмите «Добавить». |
| fill | Аты-жөнүн жазып, тобун тандаңыз. | Впишите ФИО и выберите группу. |
| more | Ата-энесинин телефону, туулган күнү жана сүрөтү сыяктуу калган талаалар милдеттүү эмес. | Остальные поля — телефон родителей, дата рождения, фото — не обязательны. |
| save | «Сактоо» баскычын басып, ырастаңыз. Окуучу тизмеге жана мугалимдин журналына кошулду. | Нажмите «Сохранить» и подтвердите. Ученик появился в списке и в журнале учителя. |

Данные: стенд `e2e/fixtures/seed.py`; новый ученик и телефон — выдуманные.

Проверка носителем языка: требуется
