# Видео: Урок хифза — посещаемость и оценки за день
feature: hifz-lesson · role: hafiz · version: 0.0.0 · device: mobile
Длительность: ~55 с

## Шаги
```yaml
- id: 1
  action: login
  value: hafiz
  pause: 1.0
  say: intro
- id: 2
  action: click
  target: role=button[name="@nav.menu"]
  pause: 0.6
- id: 3
  action: click
  target: role=link[name="@nav.hifz_journal"]
  pause: 1.0
  say: open
- id: 4
  action: highlight
  target: role=tab[name="@hifz.tab_lesson"]
  pause: 1.0
  say: lesson_tab
- id: 5
  action: click
  target: role=button[name="@journal.mark_all_present"]
  pause: 1.0
  say: attendance
- id: 6
  action: highlight
  target: .MuiPaper-root:has-text("Осмонов Абдулла")
  pause: 0.8
  say: card
- id: 7
  action: fill
  target: .MuiPaper-root:has-text("Осмонов Абдулла") >> label=@hifz.col_score
  value: "90"
  pause: 0.6
  say: hifz_score
- id: 8
  action: fill
  target: .MuiPaper-root:has-text("Осмонов Абдулла") >> label=@hifz.col_juz
  value: "1"
  pause: 0.4
- id: 9
  action: fill
  target: .MuiPaper-root:has-text("Осмонов Абдулла") >> label=@hifz.col_page_from
  value: "15"
  pause: 0.6
  say: pages
- id: 10
  action: fill
  target: .MuiPaper-root:has-text("Осмонов Абдулла") >> label=@hifz.col_score >> nth=1
  value: "85"
  pause: 0.8
  say: repeat_score
- id: 11
  action: highlight
  target: text=@hifz.autosave_hint
  pause: 1.5
  say: autosave
- id: 12
  action: wait
  pause: 1.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Хафиз тобундагы сабакты кантип белгилөөнү көрсөтөбүз. | Покажем, как вести урок в хафиз-группе. |
| open | Менюдан «Хафиз журналы» бөлүмүн ачыңыз. | В меню откройте «Журнал хафиз». |
| lesson_tab | «Сабак» өтмөгүндө бүгүнкү сабак өзү ачылат. | Во вкладке «Урок» сегодняшний урок открывается сам. |
| attendance | Адегенде катышууну белгилеңиз, кадимки сабактагыдай. | Сначала отметьте посещаемость, как на обычном уроке. |
| card | Ар бир окуучунун өз картасы бар. | У каждого ученика своя карточка. |
| hifz_score | Жаттоо бөлүгүнө бааны жазыңыз. | В разделе «Жаттоо» — новое заучивание — впишите оценку. |
| pages | Андан кийин жуз жана беттерди жазыңыз. | Затем джуз и страницы. |
| repeat_score | Кайталоо бөлүгүнө да ушундай баа коюңуз. | В разделе «Кайталоо» — повторение — так же. |
| autosave | Баары өзү сакталат. | Всё сохраняется само. |
| outro | Калган окуучулардын карталарын да ушундай толтуруңуз. | Так же заполните карточки остальных учеников. |

Данные: стенд `e2e/fixtures/seed.py` (учитель «Абдыкадыров Ислам», группа «Хафиз 1»), реальных имён нет.
Названия разделов («жаттоо», «кайталоо», «жуз») — термины интерфейса, толкования нет.

Проверка носителем языка: требуется
