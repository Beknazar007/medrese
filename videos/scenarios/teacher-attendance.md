# Видео: Как отметить посещаемость на уроке
feature: teacher-attendance · role: teacher · version: 0.0.0 · device: mobile
Длительность: ~70 с

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
  pause: 0.8
  say: menu
- id: 3
  action: click
  target: role=link[name="@nav.my_class"]
  pause: 1.0
  say: my_class
- id: 4
  action: highlight
  target: label=@journal.select_class
  pause: 1.0
  say: today
- id: 5
  action: highlight
  target: text=@journal.checked_in_at
  pause: 1.0
  say: checkin
- id: 6
  action: highlight
  target: tr:has-text("Асанов Эмир") >> .MuiToggleButtonGroup-root
  pause: 1.0
  say: letters
- id: 7
  action: click
  target: role=button[name="@journal.mark_all_present"]
  pause: 1.0
  say: all_present
- id: 8
  action: click
  target: tr:has-text("Жумабеков Адил") >> role=button[name="@journal.attendance_absent"]
  pause: 1.0
  say: absent
- id: 9
  action: click
  target: tr:has-text("Мамбетов Алихан") >> role=button[name="@journal.attendance_late"]
  pause: 1.0
  say: late
- id: 10
  action: highlight
  target: text=@hifz.autosave_hint
  pause: 1.5
  say: autosave
- id: 11
  action: click
  target: role=button[name="@journal.check_out"]
  pause: 0.8
  say: finish
- id: 12
  action: click
  target: role=dialog >> role=button[name="@journal.check_out"]
  pause: 1.5
  say: finished
- id: 13
  action: highlight
  target: text=@journal.checked_out_at
  pause: 2.0
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Бул видеодо сабакта катышууну кантип белгилөөнү көрсөтөбүз. | Покажем, как отметить посещаемость на уроке. |
| menu | Менюну ачыңыз. | Откройте меню. |
| my_class | «Менин классым» бөлүмүн тандаңыз. | Выберите «Мой класс». |
| today | Бүгүнкү сабак өзү ачылат. Башка сабакты ушул жерден тандасаңыз болот. | Сегодняшний урок открывается сам. Другой урок можно выбрать здесь. |
| checkin | Сабакты ачкан убакыт сиздин келген убактыңыз болуп жазылат. | Время, когда вы открыли урок, записывается как время прихода. |
| letters | Ар бир окуучунун жанында төрт тамга бар: К — келди, Ж — келген жок, О — кечикти, С — себеби бар. | У каждого ученика четыре буквы: К — пришёл, Ж — отсутствует, О — опоздал, С — уважительная причина. |
| all_present | Көпчүлүгү келсе, «Баарын келди деп белгилөө» баскычын басыңыз. | Если пришли почти все, нажмите «Отметить всех присутствующими». |
| absent | Келбеген окуучуга Ж тамгасын басыңыз. | Тому, кого нет, нажмите букву Ж. |
| late | Кечиккен окуучуга О тамгасын басыңыз. | Опоздавшему — букву О. |
| autosave | Сактоо баскычы жок: баары өзү сакталат. | Кнопки «Сохранить» нет: всё сохраняется само. |
| finish | Сабак бүткөндө «Сабакты аяктоо» баскычын басыңыз. | Когда урок закончится, нажмите «Завершить урок». |
| finished | Ырастаңыз. | Подтвердите. |
| outro | Даяр! Сабактын аяктаган убактысы жазылды. | Готово! Время окончания урока записано. |

Данные: стенд `e2e/fixtures/seed.py` (учитель «Мамытов Азамат», урок «Фикх», группа «Кары 1»), реальных имён нет.

Проверка носителем языка: требуется
