# Видео: Админ-аккаунты — ректор и заведующие
feature: admin-accounts · role: rector · version: 0.0.0 · device: desktop
Длительность: ~40 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- action: click
  target: role=link[name="@nav.admin_accounts"]
  pause: 1.0
  say: open
  id: 2
- action: highlight
  target: tr:has-text("dean")
  pause: 0.8
  say: list
  id: 3
- action: click
  target: main >> role=button[name="@common.add"]
  pause: 0.8
  say: add
  id: 4
- action: fill
  target: role=dialog >> label=@users.username
  value: dean2
  pause: 0.5
  say: fill
  id: 5
- action: fill
  target: role=dialog >> label=@users.password
  value: salam2026
  pause: 0.5
  id: 6
- action: click
  target: role=dialog >> label="@users.role"
  pause: 0.5
  id: 7
- action: click
  target: li:has-text("@users.role_dean")
  pause: 0.8
  say: dates
  id: 8
- action: click
  target: role=dialog >> role=button[name="@common.save"]
  pause: 0.6
  say: save
  id: 9
- action: wait
  pause: 1.5
  say: outro
  id: 11
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Ректор жана кафедра башчылары үчүн аккаунттарды ректор гана ачат. | Аккаунты ректора и заведующих создаёт только ректор. |
| open | Менюдан бөлүмдү ачыңыз. | Откройте раздел в меню. |
| list | Бул жерде мурунку жазуулар. Карандаш менен оңдойсуз, себет менен өчүрөсүз. | Здесь существующие записи. Карандаш — изменить, корзина — удалить. |
| add | Жаңысы үчүн «Кошуу» баскычын басыңыз. | Для новой записи нажмите «Добавить». |
| fill | Колдонуучунун атын жана сырсөзүн жазыңыз. | Впишите имя пользователя и пароль. |
| dates | Кызматын тандаңыз. Кафедра башчысын кийин «Кафедралар» бөлүмүндө кафедрага бекитесиз. | Выберите роль. Заведующего потом закрепите за кафедрой в разделе «Кафедры». |
| save | «Сактоо» баскычын басыңыз. | Нажмите «Сохранить». |
| outro | Даяр! Жазуу тизмеге кошулду. | Готово! Запись добавлена в список. |

Данные: стенд `e2e/fixtures/seed.py`; новые записи — выдуманные.

Проверка носителем языка: требуется
