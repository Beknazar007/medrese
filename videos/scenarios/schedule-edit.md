# Видео: Расписание — поставить урок, перенести, удалить
feature: schedule-edit · role: rector · version: 0.0.0 · device: desktop
Длительность: ~55 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- id: 2
  action: click
  target: role=link[name="@nav.schedule"]
  pause: 1.2
  say: open
- id: 3
  action: highlight
  target: main >> tbody >> tr >> nth=0
  pause: 1.0
  say: grid
- id: 4
  action: click
  target: main >> tbody >> tr >> nth=2 >> td >> nth=7 >> text=@schedule.add_hint
  pause: 1.0
  say: cell
- id: 5
  action: click
  target: role=dialog >> label=@schedule.pick_assignment
  pause: 0.5
  say: assignment
- id: 6
  action: click
  target: li:has-text("Акыйда")
  pause: 0.5
- id: 7
  action: click
  target: role=dialog >> label=@schedule.pick_room
  pause: 0.5
  say: room
- id: 8
  action: click
  target: li:has-text("201")
  pause: 0.5
- id: 9
  action: click
  target: role=dialog >> role=button[name="@common.add"]
  pause: 0.6
  say: added
- id: 10
  action: click
  target: main >> tbody >> tr >> nth=2 >> td >> nth=7 >> text=Кары 1
  pause: 1.0
  say: entry
- id: 11
  action: highlight
  target: role=dialog >> role=button[name="@schedule.move"]
  pause: 1.0
  say: move
- id: 12
  action: highlight
  target: role=dialog >> role=button[name="@common.remove"]
  pause: 1.0
  say: remove
- id: 13
  action: click
  target: role=dialog >> role=button[name="@common.close"]
  pause: 1.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Жадыбалга сабак коюуну, жылдырууну жана өчүрүүнү көрсөтөбүз. | Покажем, как поставить урок в расписание, перенести и удалить. |
| open | Менюдан «Сабак жадыбалы» бөлүмүн ачыңыз. | Откройте в меню «Расписание». |
| grid | Саптар — сабактар, мамычалар — жуманын күндөрү. | Строки — пары, столбцы — дни недели. |
| cell | Бош уячадагы «кошуу» дегенди басыңыз. | Нажмите «добавить» в свободной ячейке. |
| assignment | Дайындоону тандаңыз: мугалим, сабак жана топ. | Выберите назначение: учитель, предмет и группа. |
| room | Аудиторияны тандаңыз. | Выберите аудиторию. |
| added | «Кошуу» баскычын басыңыз. Мугалим, топ же аудитория бош эмес болсо, тиркеме эскертет. | Нажмите «Добавить». Если учитель, группа или аудитория заняты, приложение предупредит. |
| entry | Сабакты бассаңыз, анын маалыматы ачылат. | Если нажать на урок, откроются его данные. |
| move | «Жылдыруу» менен башка күнгө же сабакка которосуз. | «Перенести» — на другой день или пару. |
| remove | «Өчүрүү» менен жадыбалдан алып саласыз. | «Удалить» — убрать из расписания. |
| outro | Өзгөртүүлөр мугалимдин жадыбалында дароо көрүнөт. | Изменения сразу видны в расписании учителя. |

Данные: стенд `e2e/fixtures/seed.py`; урок ставится в 3-ю пару воскресенья — там на стенде всегда свободно.

Проверка носителем языка: требуется
