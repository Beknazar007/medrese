# Видео: Группы — обычная и хафиз
feature: groups · role: rector · version: 0.0.0 · device: desktop
Длительность: ~40 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- action: click
  target: role=link[name="@nav.groups"]
  pause: 1.0
  say: open
  id: 2
- action: highlight
  target: tr:has-text("Кары 1")
  pause: 0.8
  say: list
  id: 3
- action: click
  target: main >> role=button[name="@common.add"]
  pause: 0.8
  say: add
  id: 4
- action: fill
  target: role=dialog >> label=@groups.name
  value: Кары 3
  pause: 0.5
  say: fill
  id: 5
- action: fill
  target: role=dialog >> label=@groups.specialty
  value:
    ky: Шарият
    ru: Шариат
  pause: 0.5
  id: 6
- action: fill
  target: role=dialog >> label=@groups.course_year
  value: '1'
  pause: 0.5
  id: 7
- action: click
  target: role=dialog >> label=@groups.department
  pause: 0.5
  id: 8
- action: click
  target: li:has-text("Илим бөлүмү")
  pause: 0.5
  id: 9
- action: click
  target: role=dialog >> label=@groups.type
  pause: 0.5
  id: 10
- action: click
  target: li:has-text("@groups.type_regular")
  pause: 0.8
  say: dates
  id: 11
- action: click
  target: role=dialog >> role=button[name="@common.save"]
  pause: 0.6
  say: save
  id: 12
- action: click
  target: role=dialog >> role=button[name="@common.yes"]
  pause: 1.5
  id: 13
- action: wait
  pause: 1.5
  say: outro
  id: 14
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Окуучулар топторго бөлүнөт. | Ученики делятся на группы. |
| open | Менюдан бөлүмдү ачыңыз. | Откройте раздел в меню. |
| list | Бул жерде мурунку жазуулар. Карандаш менен оңдойсуз, себет менен өчүрөсүз. | Здесь существующие записи. Карандаш — изменить, корзина — удалить. |
| add | Жаңысы үчүн «Кошуу» баскычын басыңыз. | Для новой записи нажмите «Добавить». |
| fill | Аталышын, адистигин, курсун жана кафедрасын жазыңыз. | Впишите название, специальность, курс и кафедру. |
| dates | Түрүн тандаңыз: кадимки же хафиз. Хафиз тобу хафиз журналында иштейт. | Выберите тип: обычная или хафиз. Хафиз-группа ведётся в журнале хафиз. |
| save | «Сактоо» баскычын басып, ырастаңыз. | Нажмите «Сохранить» и подтвердите. |
| outro | Даяр! Жазуу тизмеге кошулду. | Готово! Запись добавлена в список. |

Данные: стенд `e2e/fixtures/seed.py`; новые записи — выдуманные.

Проверка носителем языка: требуется
