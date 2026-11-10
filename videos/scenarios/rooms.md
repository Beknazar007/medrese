# Видео: Аудитории
feature: rooms · role: rector · version: 0.0.0 · device: desktop
Длительность: ~40 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- action: click
  target: role=link[name="@nav.rooms"]
  pause: 1.0
  say: open
  id: 2
- action: highlight
  target: tr:has-text("101")
  pause: 0.8
  say: list
  id: 3
- action: click
  target: main >> role=button[name="@common.add"]
  pause: 0.8
  say: add
  id: 4
- action: fill
  target: role=dialog >> label=@rooms.name
  value: '202'
  pause: 0.5
  say: fill
  id: 5
- action: fill
  target: role=dialog >> label=@rooms.building
  value:
    ky: Негизги имарат
    ru: Главный корпус
  pause: 0.5
  id: 6
- action: fill
  target: role=dialog >> label=@rooms.capacity
  value: '25'
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
| intro | Аудиторияларды кошуу ректордун милдети. | Аудитории добавляет ректор. |
| open | Менюдан бөлүмдү ачыңыз. | Откройте раздел в меню. |
| list | Бул жерде мурунку жазуулар. Карандаш менен оңдойсуз, себет менен өчүрөсүз. | Здесь существующие записи. Карандаш — изменить, корзина — удалить. |
| add | Жаңысы үчүн «Кошуу» баскычын басыңыз. | Для новой записи нажмите «Добавить». |
| fill | Аудиториянын номерин жана имаратын жазыңыз. | Впишите номер аудитории и корпус. |
| dates | Сыйымдуулугу милдеттүү эмес. | Вместимость — по желанию. |
| save | «Сактоо» баскычын басып, ырастаңыз. | Нажмите «Сохранить» и подтвердите. |
| outro | Даяр! Жазуу тизмеге кошулду. | Готово! Запись добавлена в список. |

Данные: стенд `e2e/fixtures/seed.py`; новые записи — выдуманные.

Проверка носителем языка: требуется
