# Видео: Мониторинг учителей — проверить уроки и отметить причину пропуска
feature: monitoring · role: rector · version: 1.1.0 · device: desktop
Длительность: ~100 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- id: 2
  action: click
  target: role=link[name="@nav.monitoring"]
  pause: 1.0
  say: open
- id: 3
  action: click
  target: main >> role=button[name="@monitoring.range_year"]
  pause: 1.2
  say: period
- id: 4
  action: highlight
  target: role=columnheader[name="@monitoring.col_missed"]
  pause: 1.0
  say: columns
- id: 5
  action: highlight
  target: role=columnheader[name="@monitoring.col_attention"]
  pause: 1.0
  say: attention
- id: 6
  action: highlight
  target: role=columnheader[name="@monitoring.col_percent"]
  pause: 1.2
  say: percent
- id: 7
  action: click
  target: text=Садыков Эрлан
  pause: 1.2
  say: details
- id: 8
  action: highlight
  target: role=dialog >> text="@monitoring.status_missed"
  pause: 1.0
  say: missed
- id: 9
  action: click
  target: role=dialog >> role=button[name="@monitoring.mark_reason"]
  pause: 1.0
  say: mark
- id: 10
  action: highlight
  target: role=dialog[name="@monitoring.mark_reason"] >> role=radiogroup
  pause: 1.2
  say: reasons
- id: 11
  action: click
  target: role=dialog[name="@monitoring.mark_reason"] >> role=radio[name="@monitoring.reason_forgot"]
  pause: 0.8
  say: forgot
- id: 12
  action: fill
  target: role=dialog[name="@monitoring.mark_reason"] >> label=@monitoring.mark_comment
  value: {ky: "Мугалим кагаз журналга белгилеген", ru: "Учитель отметил в бумажном журнале"}
  pause: 0.5
  say: comment
- id: 13
  action: click
  target: role=dialog[name="@monitoring.mark_reason"] >> role=button[name="@common.save"]
  pause: 0.8
  say: save
- id: 14
  action: highlight
  target: role=dialog >> text="@monitoring.status_conducted_by_mark"
  pause: 1.5
  say: marked
- id: 15
  action: click
  target: role=dialog >> role=button[name="@common.close"]
  pause: 1.2
  say: close
- id: 16
  action: wait
  pause: 1.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Мугалимдер сабактарын өткөрүп жатабы, кантип текшерүүнү көрсөтөбүз. | Покажем, как проверить, проводят ли учителя уроки. |
| open | Менюдан «Мониторинг» бөлүмүн ачыңыз. | Откройте в меню «Мониторинг». |
| period | Мезгилди тандаңыз. «Жыл» баскычы бүт семестрди көрсөтөт. | Выберите период. Кнопка «Год» покажет весь семестр. |
| columns | Ар бир мугалимге: канча сабак пландалган, өткөрүлгөн, калтырылган жана кечиккен. | По каждому учителю: сколько уроков ожидалось, проведено, пропущено и с опозданием. |
| attention | «Көңүл буруу керек» — сабак ачылган, бирок студенттер белгиленбеген же сабак эрте бүткөн. | «Требует внимания» — урок открыт, но ученики не отмечены или урок закончен рано. |
| percent | Пайызы эң төмөн мугалимдер тизменин башында. Жашыл — жакшы, сары — орточо, кызыл — төмөн. | Учителя с самым низким процентом — вверху. Зелёный — хорошо, жёлтый — средне, красный — низко. |
| details | Мугалимдин атын бассаңыз, анын сабактары күн боюнча ачылат. | Нажмите на имя учителя — откроются его уроки по дням. |
| missed | Калтырылган сабак кызыл менен белгиленет. | Пропущенный урок отмечен красным. |
| mark | Сабак чындыгында болгон же жокко чыгарылган болсо, «Себебин белгилөө» баскычын басыңыз. | Если урок на самом деле был или его отменили, нажмите «Отметить причину». |
| reasons | Үч себептин бирин тандаңыз: мугалим ачканды унутуп калган, себептүү же сабак жокко чыгарылган. | Выберите одну из трёх причин: учитель забыл открыть, уважительная причина или урок отменён. |
| forgot | Биз «ачканды унутуп калган» дегенди тандайбыз. | Мы выбираем «забыл открыть». |
| comment | Кааласаңыз, түшүндүрмө жазыңыз. | По желанию напишите комментарий. |
| save | «Сактоо» баскычын басыңыз. | Нажмите «Сохранить». |
| marked | Эми сабак өткөрүлгөн деп эсептелет. Ким белгилегени да жазылып турат. | Теперь урок засчитан как проведённый. Видно и то, кто поставил отметку. |
| close | Терезени жапсаңыз, сандар өзү жаңыланат. | Закройте окно — цифры обновятся сами. |
| outro | Сабак пара бүткөндөн кийин гана калтырылган деп эсептелет. Иш эмес күндөр эсепке кирбейт. | Урок считается пропущенным только после конца пары. Нерабочие дни не считаются. |

Данные: стенд `e2e/fixtures/seed.py` (без `E2E_EXTRA_DATA`), семестр «2026 Күз» 01.09–31.12.2026, сегодня 19.11.2026. «Садыков Эрлан» пропускает часть уроков, а в начале семестра (раньше шести недель истории стенда) у него только пропуски — поэтому в периоде «Жыл» у него всегда есть строка «Калтырылган» с кнопкой «Себебин белгилөө»; шаг 9 берёт первую такую строку. Комментарий отметки выдуманный. Реальных имён нет.

Проверка носителем языка: требуется
