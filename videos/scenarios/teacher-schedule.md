# Видео: Своё расписание по дням недели
feature: teacher-schedule · role: teacher · version: 1.0.0 · device: mobile
Длительность: ~35 с

## Шаги
```yaml
- id: 1
  action: login
  value: teacher
  pause: 1.0
  say: intro
- id: 2
  action: highlight
  target: main >> .MuiToggleButtonGroup-root
  pause: 1.0
  say: days
- id: 3
  action: highlight
  target: text=Фикх
  pause: 1.0
  say: card
- id: 4
  action: highlight
  target: main >> .MuiChip-root >> nth=0
  pause: 0.8
  say: chips
- id: 5
  action: click
  target: main >> .MuiToggleButtonGroup-root >> .MuiToggleButton-root:not(.Mui-selected) >> nth=0
  pause: 1.2
  say: other_day
- id: 6
  action: highlight
  target: text=Акыйда
  pause: 1.0
  say: other_lesson
- id: 7
  action: click
  target: role=button[name="@nav.menu"]
  pause: 1.0
  say: menu
- id: 8
  action: highlight
  target: role=link[name="@nav.my_class"]
  pause: 1.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Кирген соң эле өзүңүздүн сабак жадыбалыңыз ачылат. | После входа сразу открывается ваше расписание. |
| days | Үстүндө жуманын күндөрү. Бүгүнкү күн өзү тандалат. | Сверху дни недели. Сегодняшний день выбран сам. |
| card | Ар бир сабакта адегенде сабактын аты жазылат. | В каждом уроке сначала написано название предмета. |
| chips | Астында топ жана аудитория. | Под ним группа и аудитория. |
| other_day | Башка күндү көрүү үчүн анын атын басыңыз. | Чтобы посмотреть другой день, нажмите на него. |
| other_lesson | Ошол күнү кайсы сабак, кайсы убакта экени көрүнөт. | Видно, какой урок и в какое время в этот день. |
| menu | Сабакты өткөрүү үчүн менюну ачыңыз. | Чтобы провести урок, откройте меню. |
| outro | «Менин классым» бөлүмүндө бүгүнкү сабак ачылат. Бул тууралуу өзүнчө видео бар. | В разделе «Мой класс» открывается сегодняшний урок. Об этом — отдельное видео. |

Данные: стенд `e2e/fixtures/seed.py` (учитель «Мамытов Азамат»: сегодня «Фикх», в первый другой будний день — «Акыйда»), реальных имён нет.

Проверка носителем языка: требуется
