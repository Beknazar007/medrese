# Видео: Главная страница руководства и отчёт
feature: dashboard · role: rector · version: 1.1.0 · device: desktop
Длительность: ~65 с

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
  target: main >> role=button[name="@monitoring.range_year"]
  pause: 1.2
  say: period
- id: 6
  action: highlight
  target: text="@monitoring.col_expected"
  pause: 1.0
  say: teachers
- id: 7
  action: highlight
  target: text="@monitoring.col_attention"
  pause: 1.0
  say: attention
- id: 8
  action: highlight
  target: text="@monitoring.col_percent"
  pause: 1.0
  say: percent
- id: 9
  action: highlight
  target: text=@dashboard.lowest_percent_title
  pause: 1.2
  say: lowest
- id: 10
  action: click
  target: role=button[name="@dashboard.download_report"]
  pause: 1.5
  say: report
- id: 11
  action: wait
  pause: 1.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Ректор жана декан үчүн башкы бетти көрсөтөбүз. Декан өз кафедрасын гана көрөт. | Покажем главную страницу ректора и декана. Декан видит только свою кафедру. |
| tiles | Жогоруда негизги сандар: мугалимдер, дайындоолор, жумасына сабак жана камсыздоо. | Вверху главные цифры: учителя, назначения, уроки в неделю и покрытие. |
| workload | Бул жерде ар бир мугалимдин жумалык жүктөмү. | Здесь недельная нагрузка каждого учителя. |
| unassigned | Мугалими жок сабак болсо, ушул жерде көрүнөт. | Если у предмета нет учителя, он появится здесь. |
| period | Мониторинг үчүн мезгилди тандаңыз. «Жыл» семестрдин башынан бүгүнкү күнгө чейин көрсөтөт. | Выберите период мониторинга. «Год» покажет с начала семестра по сегодня. |
| teachers | Бул жерде канча сабак пландалган, өткөрүлгөн, калтырылган жана кечиккен. | Здесь сколько уроков ожидалось, проведено, пропущено и с опозданием. |
| attention | «Көңүл буруу керек» — сабак ачылган, бирок студенттер белгиленбеген же сабак эрте бүткөн. | «Требует внимания» — урок открыт, но ученики не отмечены или урок закончен рано. |
| percent | «Өткөрүлгөн %» — пландалган сабактардын канчасы өткөрүлгөнүн көрсөтөт. | «Проведено %» — какая доля ожидаемых уроков проведена. |
| lowest | Пайызы эң төмөн беш мугалим өзүнчө көрсөтүлөт. | Отдельно — до пяти учителей с самым низким процентом. |
| report | «Отчетту жүктөп алуу» баскычы Excel файлын жүктөйт. | Кнопка «Скачать отчёт» скачивает файл Excel. |
| outro | Бул сандар «Мониторинг» бөлүмү менен дал келет. Файлды жыйналышта көрсөтсөңүз болот. | Эти цифры совпадают с разделом «Мониторинг». Файл можно показать на собрании. |

Данные: стенд `e2e/fixtures/seed.py` (без `E2E_EXTRA_DATA`), семестр «2026 Күз» 01.09–31.12.2026; период «Жыл» обрезается началом семестра, поэтому в «Эң төмөн көрсөткүч» всегда есть учителя (уроки раньше шести недель истории стенда — пропуски). Реальных имён нет.

Проверка носителем языка: требуется
