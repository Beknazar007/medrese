# Видео: Учителя — добавить и выдать логин
feature: teachers · role: rector · version: 0.0.0 · device: desktop
Длительность: ~40 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- action: click
  target: role=link[name="@nav.teachers"]
  pause: 1.0
  say: open
  id: 2
- action: highlight
  target: tr:has-text("Мамытов Азамат")
  pause: 0.8
  say: list
  id: 3
- action: click
  target: main >> role=button[name="@common.add"]
  pause: 0.8
  say: add
  id: 4
- action: fill
  target: role=dialog >> label=@teachers.username_label
  value: teacher3
  pause: 0.5
  say: fill
  id: 5
- action: fill
  target: role=dialog >> label=@teachers.password_label
  value: salam2026
  pause: 0.5
  id: 6
- action: fill
  target: role=dialog >> label=@teachers.full_name
  value: Жээнбеков Улан
  pause: 0.5
  id: 7
- action: click
  target: role=dialog >> label=@teachers.department
  pause: 0.5
  id: 8
- action: click
  target: li:has-text("Илим бөлүмү")
  pause: 0.5
  id: 9
- action: highlight
  target: role=dialog >> label=@teachers.education
  pause: 1.0
  say: dates
  id: 10
- action: click
  target: role=dialog >> role=button[name="@common.save"]
  pause: 0.6
  say: save
  id: 11
- action: click
  target: role=dialog >> role=button[name="@common.yes"]
  pause: 1.5
  id: 12
- action: wait
  pause: 1.5
  say: outro
  id: 13
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Жаңы мугалимди кошуп, ага кирүү үчүн логин беребиз. | Добавим учителя и выдадим ему логин для входа. |
| open | Менюдан бөлүмдү ачыңыз. | Откройте раздел в меню. |
| list | Бул жерде мурунку жазуулар. Карандаш менен оңдойсуз, себет менен өчүрөсүз. | Здесь существующие записи. Карандаш — изменить, корзина — удалить. |
| add | Жаңысы үчүн «Кошуу» баскычын басыңыз. | Для новой записи нажмите «Добавить». |
| fill | Логин жана сырсөз ойлоп табыңыз, аты-жөнүн жана кафедрасын жазыңыз. | Придумайте логин и пароль, впишите ФИО и кафедру. |
| dates | Билими, стажы жана сүрөтү милдеттүү эмес. | Образование, стаж и фото — по желанию. |
| save | «Сактоо» баскычын басып, ырастаңыз. | Нажмите «Сохранить» и подтвердите. |
| outro | Логин менен сырсөздү мугалимге бериңиз. Биринчи киргенде аны алмаштырат. | Передайте логин и пароль учителю. При первом входе он его сменит. |

Данные: стенд `e2e/fixtures/seed.py`; новые записи — выдуманные.

Проверка носителем языка: требуется
