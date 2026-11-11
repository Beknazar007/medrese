# Видео: Кафедры и заведующие
feature: departments · role: rector · version: 0.0.0 · device: desktop
Длительность: ~40 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- action: click
  target: role=link[name="@nav.departments"]
  pause: 1.0
  say: open
  id: 2
- action: highlight
  target: tr:has-text("Илим бөлүмү")
  pause: 0.8
  say: list
  id: 3
- action: click
  target: main >> role=button[name="@common.add"]
  pause: 0.8
  say: add
  id: 4
- action: fill
  target: role=dialog >> label=@departments.name
  value:
    ky: Араб тили бөлүмү
    ru: Отделение арабского языка
  pause: 0.5
  say: fill
  id: 5
- action: highlight
  target: role=dialog >> label=@departments.dean
  pause: 1.0
  say: dates
  id: 6
- action: click
  target: role=dialog >> role=button[name="@common.save"]
  pause: 0.6
  say: save
  id: 7
- action: click
  target: role=dialog >> role=button[name="@common.yes"]
  pause: 1.5
  id: 8
- action: wait
  pause: 1.5
  say: outro
  id: 9
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Медресенин бөлүмдөрү же кафедралары ушул жерде. | Здесь отделения, или кафедры, медресе. |
| open | Менюдан бөлүмдү ачыңыз. | Откройте раздел в меню. |
| list | Бул жерде мурунку жазуулар. Карандаш менен оңдойсуз, себет менен өчүрөсүз. | Здесь существующие записи. Карандаш — изменить, корзина — удалить. |
| add | Жаңысы үчүн «Кошуу» баскычын басыңыз. | Для новой записи нажмите «Добавить». |
| fill | Кафедранын аталышын жазыңыз. | Впишите название кафедры. |
| dates | Бул жерден кафедра башчысын тандайсыз: ал ушул кафедраны гана көрөт жана башкарат. | Здесь выбирается заведующий: он видит и ведёт только свою кафедру. |
| save | «Сактоо» баскычын басып, ырастаңыз. | Нажмите «Сохранить» и подтвердите. |
| outro | Даяр! Жазуу тизмеге кошулду. | Готово! Запись добавлена в список. |

Данные: стенд `e2e/fixtures/seed.py`; новые записи — выдуманные.

Проверка носителем языка: требуется
