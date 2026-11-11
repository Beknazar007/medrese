# Видео: План и экзамен одного ученика
feature: hifz-plans-exams · role: hafiz · version: 0.0.0 · device: mobile
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
  target: .MuiPaper-root:has-text("Осмонов Абдулла") >> role=button[name="@hifz.targets_button"]
  pause: 1.0
  say: plans_icon
- id: 5
  action: highlight
  target: role=dialog >> text=@hifz.kind_hifz
  pause: 1.0
  say: plans_list
- id: 6
  action: fill
  target: role=dialog >> label=@hifz.target_juz_from
  value: "2"
  pause: 0.4
  say: plan_add
- id: 7
  action: fill
  target: role=dialog >> label=@hifz.target_page_from
  value: "21"
  pause: 0.4
- id: 8
  action: fill
  target: role=dialog >> label=@hifz.target_page_to
  value: "40"
  pause: 0.4
- id: 9
  action: click
  target: role=dialog >> role=button[name="@hifz.target_add"]
  # «Сакталды» covers the dialog's close button for 4 s (finding B12); the recorder's mouse stays over it,
  # which pauses the toast timer — step 9c moves the mouse away first.
  pause: 0.6
  say: plan_saved
- id: 9c
  action: click
  target: role=dialog >> h2
  pause: 0.3
- id: 10
  action: click
  target: role=dialog >> role=button[name="@journal.close"]
  pause: 0.6
- id: 11
  action: click
  target: .MuiPaper-root:has-text("Осмонов Абдулла") >> role=button[name="@hifz.exams_button"]
  pause: 1.0
  say: exams_icon
- id: 12
  action: fill
  target: role=dialog >> label=@hifz.exam_score
  value: "92"
  pause: 0.4
  say: exam_fill
- id: 13
  action: fill
  target: role=dialog >> label=@hifz.exam_title
  value: {ky: "2-жуз", ru: "2-й джуз"}
  pause: 0.4
- id: 14
  action: fill
  target: role=dialog >> label=@hifz.exam_juz_from
  value: "2"
  pause: 0.6
- id: 15
  action: click
  target: role=dialog >> role=button[name="@hifz.exam_add"]
  pause: 0.6
  say: exam_saved
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Бир окуучуга план жана экзамен кошууну көрсөтөбүз. | Покажем, как добавить одному ученику план и экзамен. |
| plans_icon | «Сабак» өтмөгүндө окуучунун картасындагы «Пландар» белгисин басыңыз. | Во вкладке «Урок» нажмите значок «Планы» на карточке ученика. |
| plans_list | Мурунку пландар жогоруда. | Вверху — прежние планы. |
| plan_add | Жаңы план үчүн жуз жана беттерди жазыңыз. | Для нового плана впишите джуз и страницы. |
| plan_saved | «План кошуу» баскычын басыңыз. | Нажмите «Добавить план». |
| exams_icon | Экзамен үчүн «Экзамендер» белгисин басыңыз. | Для экзамена нажмите значок «Экзамены». |
| exam_fill | Бааны, аталышын жана жузду жазыңыз. | Впишите оценку, название и джуз. |
| exam_saved | «Экзамен кошуу» баскычын басыңыз. Экзамен журналда көрүнөт. | Нажмите «Добавить экзамен». Экзамен появится в журнале. |

Данные: стенд `e2e/fixtures/seed.py`, реальных имён нет.

Проверка носителем языка: требуется
