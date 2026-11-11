# Видео: Хафиз-журнал для ректора и декана (просмотр)
feature: hifz-view · role: rector · version: 0.0.0 · device: desktop
Длительность: ~35 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- id: 2
  action: click
  target: role=link[name="@nav.hifz_journal"]
  pause: 1.0
  say: open
- id: 3
  action: click
  target: main >> role=button[name="@hifz.period_month"]
  pause: 1.2
  say: period
- id: 4
  action: highlight
  target: role=columnheader[name="@hifz.col_average"]
  pause: 1.0
  say: average
- id: 5
  action: highlight
  target: tr:has-text("Сыдыков Билал")
  pause: 1.2
  say: row
- id: 6
  action: wait
  pause: 1.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Ректор жана декан хафиз тобунун журналын көрө алат. | Ректор и декан могут смотреть журнал хафиз-групп. |
| open | Менюдан «Хафиз журналы» бөлүмүн ачыңыз. | Откройте в меню «Журнал хафиз». |
| period | Мезгилди тандаңыз, мисалы, ай. | Выберите период, например месяц. |
| average | Ар бир окуучунун орточо баасы жана күндөр боюнча баалары. | Средний балл каждого ученика и оценки по дням. |
| row | Ж — жаттоо, К — кайталоо. | Ж — жаттоо, К — кайталоо. |
| outro | Бул жерде көрүүгө гана болот, бааларды мугалим коёт. | Здесь можно только смотреть: оценки ставит учитель. |

Данные: стенд `e2e/fixtures/seed.py`, реальных имён нет.

Проверка носителем языка: требуется
