# Видео: Как войти в приложение
feature: login · role: teacher · version: 0.1.0 · device: mobile
Длительность: ~35 с

## Шаги
```yaml
- id: 1
  action: goto
  target: /login
  pause: 1.5
  say: s1
- id: 2
  action: fill
  target: label=@login.username
  value: teacher
  pause: 1.0
  say: s2
- id: 3
  action: fill
  target: label=@login.password
  value: password
  pause: 1.0
  say: s3
- id: 4
  action: click
  target: role=button[name="@login.submit"]
  pause: 1.0
  say: s4
- id: 5
  action: wait
  target: /schedule
  pause: 2.0
  say: s5
- id: 6
  action: highlight
  target: text=Кары 1
  pause: 2.5
  say: s6
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| s1 | Салам! Бул видеодо тиркемеге кантип кирүүнү көрсөтөбүз. | Здравствуйте! В этом видео покажем, как войти в приложение. |
| s2 | Биринчи талаага колдонуучунун атын жазыңыз. Аны сизге ректор берет. | В первое поле введите имя пользователя. Его выдаёт ректор. |
| s3 | Экинчи талаага сырсөздү жазыңыз. | Во второе поле введите пароль. |
| s4 | «Кирүү» баскычын басыңыз. | Нажмите кнопку «Войти». |
| s5 | Даяр! Эми өзүңүздүн сабак жадыбалыңызды көрөсүз. | Готово! Теперь вы видите своё расписание. |
| s6 | Бүгүнкү сабактарыңыз ушул жерде көрүнөт. | Здесь видны ваши уроки на сегодня. |

Данные: стенд `e2e/fixtures/seed.py` (учитель «Мамытов Азамат», группа «Кары 1»), реальных имён нет.

Проверка носителем языка: требуется
