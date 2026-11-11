# Видео: Предметы и часы
feature: subjects · role: rector · version: 0.0.0 · device: desktop
Длительность: ~40 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- action: click
  target: role=link[name="@nav.subjects"]
  pause: 1.0
  say: open
  id: 2
- action: highlight
  target: tr:has-text("Фикх")
  pause: 0.8
  say: list
  id: 3
- action: click
  target: main >> role=button[name="@common.add"]
  pause: 0.8
  say: add
  id: 4
- action: fill
  target: role=dialog >> label=@subjects.name
  value:
    ky: Тажвид
    ru: Таджвид
  pause: 0.5
  say: fill
  id: 5
- action: fill
  target: role=dialog >> label=@subjects.code
  value: TJV1
  pause: 0.5
  id: 6
- action: click
  target: role=dialog >> label=@subjects.department
  pause: 0.5
  id: 7
- action: click
  target: li:has-text("Илим бөлүмү")
  pause: 0.5
  id: 8
- action: fill
  target: role=dialog >> label=@subjects.lecture_hours
  value: '36'
  pause: 0.5
  say: dates
  id: 9
- action: fill
  target: role=dialog >> label=@subjects.practice_hours
  value: '18'
  pause: 0.5
  id: 10
- action: fill
  target: role=dialog >> label=@subjects.lab_hours
  value: '0'
  pause: 0.5
  id: 11
- action: click
  target: role=dialog >> role=button[name="@common.save"]
  pause: 0.6
  say: save
  id: 12
- action: wait
  pause: 1.5
  say: outro
  id: 14
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Медреседе окутулган сабактардын тизмеси. | Список предметов, которые преподаются в медресе. |
| open | Менюдан бөлүмдү ачыңыз. | Откройте раздел в меню. |
| list | Бул жерде мурунку жазуулар. Карандаш менен оңдойсуз, себет менен өчүрөсүз. | Здесь существующие записи. Карандаш — изменить, корзина — удалить. |
| add | Жаңысы үчүн «Кошуу» баскычын басыңыз. | Для новой записи нажмите «Добавить». |
| fill | Аталышын, кыска кодун жана кафедрасын жазыңыз. | Впишите название, короткий код и кафедру. |
| dates | Лекция, практика жана лаборатория сааттарын жазыңыз. | Впишите часы лекций, практики и лабораторных. |
| save | «Сактоо» баскычын басыңыз. | Нажмите «Сохранить». |
| outro | Даяр! Жазуу тизмеге кошулду. | Готово! Запись добавлена в список. |

Данные: стенд `e2e/fixtures/seed.py`; новые записи — выдуманные.

Проверка носителем языка: требуется
