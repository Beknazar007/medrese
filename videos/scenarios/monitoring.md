# Видео: Мониторинг учителей — кто провёл и кто пропустил уроки
feature: monitoring · role: rector · version: 0.0.0 · device: desktop
Длительность: ~45 с

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
  target: main >> role=button[name="@monitoring.range_month"]
  pause: 1.2
  say: period
- id: 4
  action: highlight
  target: role=columnheader[name="@monitoring.col_missed"]
  pause: 1.0
  say: columns
- id: 5
  action: highlight
  target: role=columnheader[name="@monitoring.col_late"]
  pause: 0.8
  say: late
- id: 6
  action: click
  target: text=Садыков Эрлан
  pause: 1.2
  say: details
- id: 7
  action: highlight
  target: role=dialog >> text=@monitoring.status_missed
  pause: 1.2
  say: missed
- id: 8
  action: click
  target: role=dialog >> role=button[name="@common.close"]
  pause: 1.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Мугалимдер сабактарын өз убагында өткөрүп жатабы, кантип текшерүүнү көрсөтөбүз. | Покажем, как проверить, проводят ли учителя уроки вовремя. |
| open | Менюдан «Мониторинг» бөлүмүн ачыңыз. | Откройте в меню «Мониторинг». |
| period | Мезгилди тандаңыз, мисалы, ай. | Выберите период, например месяц. |
| columns | Ар бир мугалимге: канча сабак пландалган, өткөрүлгөн жана калтырылган. | По каждому учителю: сколько уроков запланировано, проведено и пропущено. |
| late | Кечиккен сабактар да эсептелет. | Опоздания тоже считаются. |
| details | Мугалимдин атын бассаңыз, анын сабактары күн боюнча ачылат. | Нажмите на имя учителя — откроются его уроки по дням. |
| missed | Калтырылган сабак кызыл менен белгиленет. | Пропущенный урок отмечен красным. |
| outro | Сабак журналда ачылбаса, ал калтырылган деп эсептелет. | Урок считается пропущенным, если его не открыли в журнале. |

Данные: стенд `e2e/fixtures/seed.py` («Садыков Эрлан» пропускает часть уроков), реальных имён нет.

Проверка носителем языка: требуется
