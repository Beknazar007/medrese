# Видео: Звонки — номера пар и время
feature: timeslots · role: rector · version: 0.0.0 · device: desktop
Длительность: ~40 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- action: click
  target: role=link[name="@nav.timeslots"]
  pause: 1.0
  say: open
  id: 2
- action: highlight
  target: tr:has-text("09:30")
  pause: 0.8
  say: list
  id: 3
- action: click
  target: main >> role=button[name="@common.add"]
  pause: 0.8
  say: add
  id: 4
- action: fill
  target: role=dialog >> label=@timeslots.order
  value: '4'
  pause: 0.5
  say: fill
  id: 5
- action: fill
  target: role=dialog >> label=@timeslots.start
  value: '13:30'
  pause: 0.5
  id: 6
- action: fill
  target: role=dialog >> label=@timeslots.end
  value: '14:50'
  pause: 0.5
  say: dates
  id: 7
- action: click
  target: role=dialog >> role=button[name="@common.save"]
  pause: 0.6
  say: save
  id: 8
- action: click
  target: role=dialog >> role=button[name="@common.yes"]
  pause: 1.5
  id: 9
- action: wait
  pause: 1.5
  say: outro
  id: 10
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Сабак убактыларын, башкача айтканда коңгуроолорду, ректор коёт. | Время пар — звонки — задаёт ректор. |
| open | Менюдан бөлүмдү ачыңыз. | Откройте раздел в меню. |
| list | Бул жерде мурунку жазуулар. Карандаш менен оңдойсуз, себет менен өчүрөсүз. | Здесь существующие записи. Карандаш — изменить, корзина — удалить. |
| add | Жаңысы үчүн «Кошуу» баскычын басыңыз. | Для новой записи нажмите «Добавить». |
| fill | Сабактын номерин жазыңыз. | Впишите номер пары. |
| dates | Башталыш жана аяктоо убактысын коюңуз. | Укажите время начала и конца. |
| save | «Сактоо» баскычын басып, ырастаңыз. | Нажмите «Сохранить» и подтвердите. |
| outro | Даяр! Жазуу тизмеге кошулду. | Готово! Запись добавлена в список. |

Данные: стенд `e2e/fixtures/seed.py`; новые записи — выдуманные.

Проверка носителем языка: требуется
