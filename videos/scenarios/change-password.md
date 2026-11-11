# Видео: Как сменить пароль
feature: change-password · role: teacher · version: 0.0.0 · device: mobile
Длительность: ~45 с

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
  pause: 0.8
  say: menu
- id: 3
  action: click
  target: role=button[name="@nav.change_password"]
  pause: 1.0
  say: item
- id: 4
  action: fill
  target: role=dialog >> label=@password.current
  value: password
  pause: 0.8
  say: current
- id: 5
  action: fill
  target: role=dialog >> label=@password.new_password
  value: salam2026
  pause: 0.8
  say: new
- id: 6
  action: fill
  target: role=dialog >> label=@password.confirm
  value: salam2026
  pause: 0.8
  say: repeat
- id: 7
  action: click
  target: role=dialog >> role=button[name="@password.save"]
  pause: 1.0
  say: save
- id: 8
  action: wait
  target: /schedule
  pause: 2.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Ректор берген сырсөздү өзүңүздүкүнө алмаштырыңыз. Кантип экенин көрсөтөбүз. | Пароль, выданный ректором, лучше сменить на свой. Покажем как. |
| menu | Менюну ачыңыз. | Откройте меню. |
| item | «Сырсөздү алмаштыруу» дегенди басыңыз. | Нажмите «Сменить пароль». |
| current | Азыркы сырсөздү жазыңыз. | Введите текущий пароль. |
| new | Жаңы сырсөздү жазыңыз, кеминде алты белги. | Введите новый пароль, не короче шести символов. |
| repeat | Жаңы сырсөздү дагы бир жолу жазыңыз. | Повторите новый пароль. |
| save | «Сактоо» баскычын басыңыз. | Нажмите «Сохранить». |
| outro | Ылдыйда «Сырсөз алмаштырылды» деген билдирүү чыкты. Кийинки жолу жаңы сырсөз менен киресиз. | Внизу появилось сообщение «Пароль изменён». В следующий раз входите с новым паролем. |

Данные: стенд `e2e/fixtures/seed.py`, реальных имён нет.

Проверка носителем языка: требуется
