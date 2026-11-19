# Видео: Звонки — номера пар, время и порог опоздания
feature: timeslots · role: rector · version: 1.1.0 · device: desktop
Длительность: ~70 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- id: 2
  action: click
  target: role=link[name="@nav.timeslots"]
  pause: 1.0
  say: open
- id: 3
  action: highlight
  target: label=@timeslots.late_threshold
  pause: 1.2
  say: threshold
# Поле порога — type=number со значением 15: «fill» печатает по буквам и дописал бы «10» к «15»,
# поэтому сначала выделяем всё и стираем.
- id: 4
  action: click
  target: label=@timeslots.late_threshold
  pause: 0.3
- id: 5
  action: press
  value: Control+a
  pause: 0.2
- id: 6
  action: press
  value: Backspace
  pause: 0.2
- id: 7
  action: fill
  target: label=@timeslots.late_threshold
  value: '10'
  pause: 0.6
  say: threshold_fill
- id: 8
  action: click
  target: main >> role=button[name="@common.save"]
  pause: 0.8
  say: threshold_save
- id: 9
  action: highlight
  target: main >> text=@common.saved
  pause: 1.2
  say: threshold_saved
- id: 10
  action: highlight
  target: tr:has-text("09:30")
  pause: 0.8
  say: list
- id: 11
  action: click
  target: main >> role=button[name="@common.add"]
  pause: 0.8
  say: add
- id: 12
  action: fill
  target: role=dialog >> label=@timeslots.order
  value: '4'
  pause: 0.5
  say: fill
- id: 13
  action: fill
  target: role=dialog >> label=@timeslots.start
  value: '13:30'
  pause: 0.5
- id: 14
  action: fill
  target: role=dialog >> label=@timeslots.end
  value: '14:50'
  pause: 0.5
  say: dates
- id: 15
  action: click
  target: role=dialog >> role=button[name="@common.save"]
  pause: 0.6
  say: save
- id: 16
  action: wait
  pause: 1.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Сабак убактыларын, башкача айтканда коңгуроолорду, ректор коёт. | Время пар — звонки — задаёт ректор. |
| open | Менюдан бөлүмдү ачыңыз. | Откройте раздел в меню. |
| threshold | Жогоруда — кечигүү босогосу. Сабак ушунча мүнөттөн кеч ачылса, кечикти деп эсептелет. | Вверху — порог опоздания. Если урок открыт позже на столько минут, это опоздание. |
| threshold_fill | 0дөн 60ка чейин сан жазыңыз, мисалы, 10. | Впишите число от 0 до 60, например 10. |
| threshold_save | Жанындагы «Сактоо» баскычын басыңыз. | Нажмите «Сохранить» рядом с полем. |
| threshold_saved | «Сакталды» чыкты. Мониторингдеги кечигүүлөр дароо кайра эсептелет. | Появилось «Сохранено». Опоздания в мониторинге сразу пересчитаются. |
| list | Төмөндө пары тизмеси. Карандаш менен оңдойсуз, себет менен өчүрөсүз. | Ниже список пар. Карандаш — изменить, корзина — удалить. |
| add | Жаңы пара үчүн «Кошуу» баскычын басыңыз. | Для новой пары нажмите «Добавить». |
| fill | Сабактын номерин жазыңыз. | Впишите номер пары. |
| dates | Башталыш жана аяктоо убактысын коюңуз. | Укажите время начала и конца. |
| save | «Сактоо» баскычын басыңыз. | Нажмите «Сохранить». |
| outro | Даяр! Жаңы пара тизмеге кошулду. | Готово! Новая пара добавлена в список. |

Данные: стенд `e2e/fixtures/seed.py` (пары 1–3, порог по умолчанию 15 мин); порог 10 мин и пара 4 (13:30–14:50) — выдуманные, стенд пересоздаётся при каждой записи. Реальных имён нет.

Проверка носителем языка: требуется
