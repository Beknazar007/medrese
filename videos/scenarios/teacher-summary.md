# Видео: Итоги по классу — средний балл и посещаемость
feature: teacher-summary · role: teacher · version: 0.0.0 · device: mobile
Длительность: ~35 с

## Шаги
```yaml
- id: 1
  action: login
  value: teacher
  pause: 1.0
  say: intro
- id: 2
  action: click
  target: role=button[name="@nav.menu"]
  pause: 0.6
- id: 3
  action: click
  target: role=link[name="@nav.my_class"]
  pause: 1.0
  say: open_class
- id: 4
  action: click
  target: role=button[name="@journal.performance_title"]
  pause: 1.5
  say: button
- id: 5
  action: highlight
  target: role=dialog >> role=columnheader[name="@journal.col_average"]
  pause: 1.0
  say: average
- id: 6
  action: highlight
  target: role=dialog >> role=columnheader[name="@journal.col_attendance"]
  pause: 1.0
  say: bar
- id: 7
  action: click
  target: role=dialog >> role=button[name="@journal.close"]
  pause: 1.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Классыңыздын жыйынтыгын кантип көрүүнү көрсөтөбүз. | Покажем, как посмотреть итоги по классу. |
| open_class | «Менин классым» бөлүмүн ачыңыз. | Откройте «Мой класс». |
| button | «Класстын жыйынтыгы» баскычын басыңыз. | Нажмите «Итоги по классу». |
| average | Бул жерде ар бир окуучунун орточо баасы. | Здесь средний балл каждого ученика. |
| bar | Түстүү тилке катышууну көрсөтөт: жашыл — келди, кызыл — келген жок. | Цветная полоска — посещаемость: зелёный — пришёл, красный — отсутствовал. |
| outro | «Жабуу» баскычы менен журналга кайтасыз. | Кнопкой «Закрыть» вернётесь в журнал. |

Данные: стенд `e2e/fixtures/seed.py` (шесть прошлых недель уроков), реальных имён нет.

Проверка носителем языка: требуется
