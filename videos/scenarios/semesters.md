# Видео: Семестры — создать и сделать активным
feature: semesters · role: rector · version: 0.0.0 · device: desktop
Длительность: ~40 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- action: click
  target: role=link[name="@nav.semesters"]
  pause: 1.0
  say: open
  id: 2
- action: highlight
  target: tr:has-text("2026 Күз")
  pause: 0.8
  say: list
  id: 3
- action: click
  target: main >> role=button[name="@common.add"]
  pause: 0.8
  say: add
  id: 4
- action: fill
  target: role=dialog >> label=@semesters.name
  value:
    ky: 2027 Жаз
    ru: 2027 Весна
  pause: 0.5
  say: fill
  id: 5
- action: fill
  target: role=dialog >> label=@semesters.start
  value: '2027-02-01'
  pause: 0.5
  id: 6
- action: fill
  target: role=dialog >> label=@semesters.end
  value: '2027-06-30'
  pause: 0.5
  say: dates
  id: 7
- action: click
  target: role=dialog >> label=@semesters.active
  pause: 1.0
  say: active
  id: 8
- action: click
  target: role=dialog >> role=button[name="@common.save"]
  pause: 0.6
  say: save
  id: 9
- action: click
  target: role=dialog >> role=button[name="@common.yes"]
  pause: 1.5
  id: 10
- action: wait
  pause: 1.5
  say: outro
  id: 11
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Окуу жылын семестрлерге бөлөбүз. Муну ректор гана кылат. | Учебный год делится на семестры. Это делает только ректор. |
| open | Менюдан бөлүмдү ачыңыз. | Откройте раздел в меню. |
| list | Бул жерде мурунку жазуулар. Карандаш менен оңдойсуз, себет менен өчүрөсүз. | Здесь существующие записи. Карандаш — изменить, корзина — удалить. |
| add | Жаңысы үчүн «Кошуу» баскычын басыңыз. | Для новой записи нажмите «Добавить». |
| fill | Аталышын жазыңыз. | Впишите название. |
| dates | Башталышын жана аягын тандаңыз. | Укажите начало и конец. |
| active | «Активдүү» белгисин күйгүзсөңүз, бул семестр бардык барактарда өзү тандалат. | Если включить «Активный», этот семестр будет выбираться на всех страницах сам. |
| save | «Сактоо» баскычын басып, ырастаңыз. | Нажмите «Сохранить» и подтвердите. |
| outro | Даяр! Жазуу тизмеге кошулду. | Готово! Запись добавлена в список. |

Данные: стенд `e2e/fixtures/seed.py`; новые записи — выдуманные.

Проверка носителем языка: требуется
