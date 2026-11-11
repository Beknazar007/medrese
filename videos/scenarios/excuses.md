# Видео: Освобождение ученика — пропуск по уважительной причине
feature: excuses · role: rector · version: 0.0.0 · device: desktop
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
  target: role=link[name="@nav.excuses"]
  pause: 1.0
  say: open
- id: 3
  action: highlight
  target: tr:has-text("Касымов Байэл")
  pause: 1.0
  say: list
- id: 4
  action: click
  target: main >> role=button[name="@common.add"]
  pause: 1.0
  say: add
- id: 5
  action: click
  target: role=dialog >> label=@excuses.student
  pause: 0.6
  say: student
- id: 6
  action: click
  target: li:has-text("Жумабеков Адил")
  pause: 0.8
- id: 7
  action: highlight
  target: role=dialog >> label=@excuses.date_to
  pause: 1.0
  say: dates
- id: 8
  action: fill
  target: role=dialog >> label=@excuses.reason
  value: {ky: "Үй-бүлөлүк себеп (ата-энеси кайрылды)", ru: "Семейные обстоятельства (обратились родители)"}
  pause: 0.6
  say: reason
- id: 9
  action: click
  target: role=dialog >> role=button[name="@common.save"]
  pause: 0.6
  say: save
- id: 10
  action: highlight
  target: tr:has-text("Жумабеков Адил")
  pause: 1.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Окуучу ооруп же башка себеп менен келбесе, аны алдын ала белгилесеңиз болот. | Если ученик болеет или отсутствует по причине, это можно отметить заранее. |
| open | Менюдан «Себептүү жоктуктар» бөлүмүн ачыңыз. | Откройте в меню «Пропуски по уважительной причине». |
| list | Бул жерде мурунку жазуулар: ким, кайсы күндөрү жана эмне себептен. | Здесь прежние записи: кто, в какие дни и по какой причине. |
| add | Жаңысын кошуу үчүн «Кошуу» баскычын басыңыз. | Чтобы добавить, нажмите «Добавить». |
| student | Окуучуну тандаңыз. | Выберите ученика. |
| dates | Кайсы күндөн кайсы күнгө чейин экенин белгилеңиз. | Укажите, с какого по какой день. |
| reason | Себебин жазыңыз. | Напишите причину. |
| save | «Сактоо» баскычын басыңыз. | Нажмите «Сохранить». |
| outro | Ушул күндөрү мугалимдин журналында окуучу өзү «себеби бар» деп белгиленет. | В эти дни ученик в журнале учителя сам будет отмечен «уважительная причина». |

Данные: стенд `e2e/fixtures/seed.py`, реальных имён нет.

Проверка носителем языка: требуется
