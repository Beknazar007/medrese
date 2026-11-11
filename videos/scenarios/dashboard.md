# Видео: Главная страница руководства и отчёт
feature: dashboard · role: rector · version: 0.0.0 · device: desktop
Длительность: ~55 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.5
  say: intro
- id: 2
  action: highlight
  target: text=@dashboard.stat_coverage
  pause: 1.0
  say: tiles
- id: 3
  action: highlight
  target: text=@dashboard.teacher_workload
  pause: 1.0
  say: workload
- id: 4
  action: highlight
  target: text=@dashboard.unassigned_subjects
  pause: 1.0
  say: unassigned
- id: 5
  action: click
  target: main >> role=button[name="@monitoring.range_month"]
  pause: 1.2
  say: period
- id: 6
  action: highlight
  target: text=@dashboard.teacher_monitoring_title
  pause: 1.0
  say: teachers
- id: 7
  action: highlight
  target: text=@dashboard.top_missed_title
  pause: 1.0
  say: top_missed
- id: 8
  action: click
  target: role=button[name="@dashboard.download_report"]
  pause: 1.5
  say: report
- id: 9
  action: wait
  pause: 1.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Ректор жана декан үчүн башкы бетти көрсөтөбүз. Декан өз бөлүмүн гана көрөт. | Покажем главную страницу ректора и декана. Декан видит только своё отделение. |
| tiles | Жогоруда негизги сандар: мугалимдер, дайындоолор, жумасына сабак жана камсыздоо. | Вверху главные цифры: учителя, назначения, уроки в неделю и покрытие. |
| workload | Бул жерде ар бир мугалимдин жумалык жүктөмү. | Здесь недельная нагрузка каждого учителя. |
| unassigned | Мугалими жок сабак болсо, ушул жерде көрүнөт. | Если у предмета нет учителя, он появится здесь. |
| period | Мониторинг үчүн мезгилди тандаңыз: күн, жума, ай же жыл. | Для мониторинга выберите период: день, неделя, месяц или год. |
| teachers | Канча сабак пландалган, өткөрүлгөн жана калтырылган. | Сколько уроков запланировано, проведено и пропущено. |
| top_missed | Эң көп сабак калтырган мугалимдер өзүнчө көрсөтүлөт. | Отдельно — учителя, пропустившие больше всего уроков. |
| report | «Отчетту жүктөп алуу» баскычы Excel файлын жүктөйт. | Кнопка «Скачать отчёт» скачивает файл Excel. |
| outro | Файлды ачып, жыйналышта же басып чыгарып колдонсоңуз болот. | Его можно открыть, распечатать или показать на собрании. |

Данные: стенд `e2e/fixtures/seed.py`, реальных имён нет.

Проверка носителем языка: требуется
