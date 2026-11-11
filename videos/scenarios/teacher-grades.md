# Видео: Как поставить оценки за экзамен
feature: teacher-grades · role: teacher · version: 0.0.0 · device: mobile
Длительность: ~50 с

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
  target: label=@journal.exam_toggle
  pause: 1.0
  say: exam
- id: 5
  action: highlight
  target: div[data-testid=attendance-card] >> nth=0 >> label=@journal.col_grade
  pause: 1.0
  say: column
- id: 6
  action: click
  target: role=button[name="@journal.mark_all_present"]
  pause: 1.0
  say: attendance
- id: 7
  action: fill
  target: div[data-testid=attendance-card]:has-text("Асанов Эмир") >> input[type=number]
  value: "85"
  pause: 0.8
  say: score
- id: 8
  action: fill
  target: div[data-testid=attendance-card]:has-text("Бакиров Нурислам") >> input[type=number]
  value: "92"
  pause: 0.8
- id: 9
  action: fill
  target: div[data-testid=attendance-card]:has-text("Жумабеков Адил") >> input[type=number]
  value: "74"
  pause: 0.8
  say: next
- id: 10
  action: highlight
  target: text=@hifz.autosave_hint
  pause: 2.0
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Бул видеодо сынак сабагында баа коюуну көрсөтөбүз. | Покажем, как поставить оценки на экзаменационном уроке. |
| open_class | «Менин классым» бөлүмүн ачыңыз. Бүгүнкү сабак өзү ачылат. | Откройте «Мой класс». Сегодняшний урок откроется сам. |
| exam | Баа сынак сабагында гана коюлат. «Бул — сынак» белгисин басыңыз. | Оценки ставятся только за экзамен. Отметьте «Это экзамен». |
| column | Ар бир окуучуда баа үчүн талаа пайда болду. | У каждого ученика появилось поле для оценки. |
| attendance | Адегенде ким келгенин белгилеңиз. | Сначала отметьте, кто пришёл. |
| score | Ар бир окуучуга нөлдөн жүзгө чейин баа жазыңыз. | Впишите каждому оценку от нуля до ста. |
| next | Калган окуучуларга да ушундай жазасыз. | Остальным — так же. |
| outro | Баалар өзү сакталат. Даяр! | Оценки сохраняются сами. Готово! |

Данные: стенд `e2e/fixtures/seed.py`, реальных имён нет.

Проверка носителем языка: требуется
