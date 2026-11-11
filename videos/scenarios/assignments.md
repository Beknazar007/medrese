# Видео: Назначения — кто какой предмет ведёт в группе
feature: assignments · role: rector · version: 0.0.0 · device: desktop
Длительность: ~40 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- action: click
  target: role=link[name="@nav.assignments"]
  pause: 1.0
  say: open
  id: 2
- action: highlight
  target: tr:has-text("Акыйда")
  pause: 0.8
  say: list
  id: 3
- action: click
  target: main >> role=button[name="@common.add"]
  pause: 0.8
  say: add
  id: 4
- action: click
  target: role=dialog >> label=@assignments.field_teacher
  pause: 0.5
  id: 5
- action: click
  target: li:has-text("Садыков Эрлан")
  pause: 0.5
  id: 6
- action: click
  target: role=dialog >> label=@assignments.field_subject
  pause: 0.5
  say: fill
  id: 7
- action: click
  target: li:has-text("Акыйда")
  pause: 0.5
  id: 8
- action: click
  target: role=dialog >> label=@assignments.field_group
  pause: 0.5
  id: 9
- action: click
  target: li:has-text("Кары 2")
  pause: 0.5
  id: 10
- action: click
  target: role=dialog >> label=@assignments.field_semester
  pause: 0.5
  id: 11
- action: click
  target: li:has-text("2026 Күз")
  pause: 0.5
  id: 12
- action: click
  target: role=dialog >> label=@assignments.field_type
  pause: 0.5
  say: dates
  id: 13
- action: click
  target: role=listbox >> li >> nth=0
  pause: 0.8
  id: 14
- action: click
  target: role=dialog >> role=button[name="@common.save"]
  pause: 0.6
  say: save
  id: 15
- action: click
  target: role=dialog >> role=button[name="@common.yes"]
  pause: 1.5
  id: 16
- action: wait
  pause: 1.5
  say: outro
  id: 17
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Дайындоо — бул мугалим, сабак жана топ, бир семестрге. | Назначение — это учитель, предмет и группа на семестр. |
| open | Менюдан бөлүмдү ачыңыз. | Откройте раздел в меню. |
| list | Бул жерде мурунку жазуулар. Карандаш менен оңдойсуз, себет менен өчүрөсүз. | Здесь существующие записи. Карандаш — изменить, корзина — удалить. |
| add | Жаңысы үчүн «Кошуу» баскычын басыңыз. | Для новой записи нажмите «Добавить». |
| fill | Мугалимди, сабакты, топту жана семестрди тандаңыз. | Выберите учителя, предмет, группу и семестр. |
| dates | Саат түрүн тандаңыз. Андан кийин дайындоону жадыбалга коёсуз. | Выберите тип часов. Потом назначение ставится в расписание. |
| save | «Сактоо» баскычын басып, ырастаңыз. | Нажмите «Сохранить» и подтвердите. |
| outro | Даяр! Жазуу тизмеге кошулду. | Готово! Запись добавлена в список. |

Данные: стенд `e2e/fixtures/seed.py`; новые записи — выдуманные.

Проверка носителем языка: требуется
