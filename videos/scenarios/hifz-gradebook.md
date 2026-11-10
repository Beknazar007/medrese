# Видео: Журнал хифза — оценки по дням
feature: hifz-gradebook · role: hafiz · version: 0.0.0 · device: mobile
Длительность: ~50 с

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
  target: role=tab[name="@hifz.tab_journal"]
  pause: 1.0
  say: tab
- id: 5
  action: click
  target: role=button[name="@hifz.period_month"]
  pause: 1.5
  say: month
- id: 6
  action: highlight
  target: role=columnheader[name="@hifz.col_average"]
  pause: 1.0
  say: average
- id: 7
  action: highlight
  target: text=@hifz.legend_click_to_grade
  pause: 1.0
  say: legend
- id: 8
  action: click
  target: role=button[name="@hifz.period_today"]
  pause: 0.8
  say: today
- id: 9
  action: click
  target: tr:has-text("Осмонов Абдулла") >> td >> nth=3
  pause: 1.0
  say: cell
- id: 10
  action: fill
  target: role=dialog >> label=@hifz.score_pct
  value: "88"
  pause: 0.8
  say: score
- id: 11
  action: click
  target: role=dialog >> role=button[name="@hifz.done"]
  pause: 1.0
  say: done
- id: 12
  action: highlight
  target: tr:has-text("Осмонов Абдулла")
  pause: 2.0
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Хафиз журналында бааларды күн боюнча кантип көрүүнү көрсөтөбүз. | Покажем, как смотреть и ставить оценки хифза по дням. |
| tab | «Журнал» өтмөгүн ачыңыз. | Откройте вкладку «Журнал». |
| month | Мезгилди тандаңыз: бүгүн, жума, ай же өзүңүз каалаган аралык. | Выберите период: сегодня, неделя, месяц или свой. |
| average | Бул жерде ар бир окуучунун орточо баасы. | Здесь средний балл каждого ученика. |
| legend | Ж — жаттоо, К — кайталоо. Баа коюу үчүн күндү басыңыз. | Ж — жаттоо, К — кайталоо. Чтобы поставить оценку, нажмите на день. |
| today | Мисалы, бүгүнкү күнгө баа коёлу. | Например, поставим оценку за сегодня. |
| cell | Окуучунун бүгүнкү күнүн басыңыз. | Нажмите на сегодняшний день ученика. |
| score | Бааны пайыз менен жазыңыз. | Впишите оценку в процентах. |
| done | «Даяр» баскычын басыңыз. | Нажмите «Готово». |
| outro | Баа журналга кошулду. Мурунку күндөрдү да ушундай оңдосоңуз болот. | Оценка в журнале. Так же можно исправить и прошлые дни. |

Данные: стенд `e2e/fixtures/seed.py` (две недели оценок хифза), реальных имён нет.

Проверка носителем языка: требуется
