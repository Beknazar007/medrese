# Видео: Задания хифза — выдать задание группе
feature: hifz-assignments · role: hafiz · version: 0.0.0 · device: mobile
Длительность: ~60 с

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
  pause: 0.8
- id: 4
  action: click
  target: role=tab[name="@hifz.tab_assignments"]
  pause: 1.0
  say: tab
- id: 5
  action: highlight
  target: .MuiPaper-root:has-text("Сыдыков Билал")
  pause: 1.0
  say: card
- id: 6
  action: click
  target: role=button[name="@hifz.assignment_new"]
  pause: 1.0
  say: new
- id: 7
  action: click
  target: role=dialog >> role=button[name="@hifz.select_all"]
  pause: 1.0
  say: students
- id: 8
  action: highlight
  target: role=dialog >> text=@hifz.kind_hifz
  pause: 1.0
  say: kind
- id: 9
  action: fill
  target: role=dialog >> label=@hifz.target_juz_from
  value: "2"
  pause: 0.5
  say: range
- id: 10
  action: fill
  target: role=dialog >> label=@hifz.target_page_from
  value: "21"
  pause: 0.4
- id: 11
  action: fill
  target: role=dialog >> label=@hifz.target_page_to
  value: "40"
  pause: 0.6
- id: 12
  action: highlight
  target: role=dialog >> label=@hifz.target_end_date
  pause: 1.0
  say: dates
- id: 13
  action: fill
  target: role=dialog >> label=@hifz.target_note
  value: {ky: "күнүнө 1 бет", ru: "по 1 странице в день"}
  pause: 0.6
  say: note
- id: 14
  action: click
  target: role=dialog >> role=button[name="@hifz.assignment_issue"]
  pause: 0.6
  say: issue
- id: 15
  action: click
  target: role=dialog >> role=button[name="@common.yes"]
  pause: 1.0
- id: 16
  action: wait
  pause: 2.5
  say: issued
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Окуучуларга тапшырма берүүнү көрсөтөбүз. | Покажем, как выдать ученикам задание. |
| tab | «Тапшырмалар» өтмөгүн ачыңыз. | Откройте вкладку «Задания». |
| card | Ар бир картада тапшырма, мөөнөт, канча күн өттү жана орточо баа. | В каждой карточке — задание, срок, сколько дней прошло и средний балл. |
| new | Жаңы тапшырма үчүн «Тапшырма берүү» баскычын басыңыз. | Для нового задания нажмите «Выдать задание». |
| students | Окуучуларды тандаңыз: баарын же айрымдарын. | Выберите учеников: всех или некоторых. |
| kind | Түрүн тандаңыз: жаттоо же кайталоо. | Выберите вид: жаттоо или кайталоо. |
| range | Жуз жана беттерди жазыңыз. | Впишите джуз и страницы. |
| dates | Башталышын жана аягын тандаңыз. | Выберите начало и конец. |
| note | Кааласаңыз, эскертүү жазыңыз. | При желании — примечание. |
| issue | «Берүү» баскычын басып, ырастаңыз. | Нажмите «Выдать» и подтвердите. |
| issued | Тапшырма бардык тандалган окуучуларга берилди. | Задание получили все выбранные ученики. |

Данные: стенд `e2e/fixtures/seed.py`, реальных имён нет.

Проверка носителем языка: требуется
