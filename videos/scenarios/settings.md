# Видео: Язык интерфейса, ночной режим и выход
feature: settings · role: teacher · version: 0.0.0 · device: mobile
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
  target: role=combobox
  pause: 0.8
  say: language
- id: 4
  action: click
  target: {ky: 'role=option[name="Русский"]', ru: 'role=option[name="Кыргызча"]'}
  pause: 1.5
  say: switched
- id: 5
  action: click
  target: role=combobox
  pause: 0.6
- id: 6
  action: click
  target: {ky: 'role=option[name="Кыргызча"]', ru: 'role=option[name="Русский"]'}
  pause: 1.0
  say: back
- id: 7
  action: press
  value: Escape
  pause: 0.5
- id: 8
  action: click
  target: role=button[name="@nav.dark_mode"]
  pause: 1.5
  say: dark
- id: 9
  action: click
  target: role=button[name="@nav.light_mode"]
  pause: 1.0
  say: light
- id: 10
  action: click
  target: role=button[name="@nav.logout"]
  pause: 1.0
  say: logout
- id: 11
  action: click
  target: role=dialog >> role=button[name="@common.cancel"]
  pause: 1.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Тилди алмаштырууну, түнкү режимди жана чыгууну көрсөтөбүз. | Покажем, как сменить язык, включить ночной режим и выйти. |
| menu | Менюну ачыңыз. | Откройте меню. |
| language | Жогору жакта тил тандалат. | Вверху выбирается язык. |
| switched | Тиркеме дароо башка тилде көрүнөт. | Приложение сразу показывается на другом языке. |
| back | Кайра өз тилиңизди тандаңыз. | Выберите обратно свой язык. |
| dark | Ай белгиси — түнкү режим. Караңгыда көзгө жеңил. | Значок луны — ночной режим. В темноте глазам легче. |
| light | Күн белгиси менен кадимки режимге кайтасыз. | Значок солнца возвращает дневной режим. |
| logout | Эшик белгиси — тиркемеден чыгуу. | Значок двери — выход из приложения. |
| outro | Чыкпай калуу үчүн «Жокко чыгаруу» баскычын басыңыз. | Чтобы остаться, нажмите «Отмена». |

Данные: стенд `e2e/fixtures/seed.py`, реальных имён нет.

Проверка носителем языка: требуется
