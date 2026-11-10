# Видео: Как установить «Медресе» на телефон
feature: install-app · role: all · version: 0.0.0 · device: slides
Длительность: ~30 с на каждый телефон

Один ролик на телефон: человек смотрит только свой. Экран нарисован (`videos/tools/slides/phone.html`):
меню браузера и главный экран — упрощённые схемы, внутри «браузера» — настоящее приложение со стенда.
Меню подписаны по-русски: у iPhone нет кыргызского интерфейса, кыргызская озвучка называет пункты по-русски.

## Сценарий: iphone-safari
device: slides
```yaml
- id: 1
  action: goto
  target: "{tools}/slides/phone.html?screen=safari&app={base}"
  pause: 0.5
- id: 2
  action: eval
  target: "__label('iPhone · Safari')"
  pause: 0.3
  say: intro_safari
- id: 3
  action: eval
  target: "show('tap-share')"
  say: share_bottom
- id: 4
  action: eval
  target: "show('sheet')"
  say: sheet
- id: 5
  action: eval
  target: "show('add')"
  say: add
- id: 6
  action: eval
  target: "show('home')"
  say: home
- id: 7
  action: eval
  target: "show('opened')"
  pause: 2.0
  say: opened
```

## Сценарий: iphone-chrome
device: slides
```yaml
- id: 1
  action: goto
  target: "{tools}/slides/phone.html?screen=chrome-ios&app={base}"
  pause: 0.5
- id: 2
  action: eval
  target: "__label('iPhone · Chrome')"
  pause: 0.3
  say: intro_chrome_ios
- id: 3
  action: eval
  target: "show('tap-share')"
  say: share_bar
- id: 4
  action: eval
  target: "show('sheet')"
  say: sheet
- id: 5
  action: eval
  target: "show('add')"
  say: add
- id: 6
  action: eval
  target: "show('home')"
  say: home
- id: 7
  action: eval
  target: "show('opened')"
  pause: 2.0
  say: opened
```

## Сценарий: android-chrome
device: slides
```yaml
- id: 1
  action: goto
  target: "{tools}/slides/phone.html?screen=android&app={base}"
  pause: 0.5
- id: 2
  action: eval
  target: "__label('Android · Chrome')"
  pause: 0.3
  say: intro_android
- id: 3
  action: eval
  target: "show('tap-menu')"
  say: menu_dots
- id: 4
  action: eval
  target: "show('menu')"
  say: menu_install
- id: 5
  action: eval
  target: "show('install')"
  pause: 2.5
  say: install
- id: 6
  action: eval
  target: "show('home')"
  say: home
- id: 7
  action: eval
  target: "show('opened')"
  pause: 2.0
  say: opened
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro_safari | «Медресе» тиркемесин iPhone'дун башкы экранына кошобуз. Сайтты Safari'де ачыңыз. | Добавим «Медресе» на главный экран iPhone. Откройте сайт в Safari. |
| intro_chrome_ios | «Медресе» тиркемесин iPhone'дун башкы экранына кошобуз. Сайтты Chrome'до ачыңыз. | Добавим «Медресе» на главный экран iPhone. Откройте сайт в Chrome. |
| intro_android | «Медресе» тиркемесин Android телефонго орнотобуз. Сайтты Chrome'до ачыңыз. | Установим «Медресе» на Android. Откройте сайт в Chrome. |
| share_bottom | Ылдыйдагы «Поделиться» баскычын басыңыз: жебеси бар төрт бурчтук. | Нажмите кнопку «Поделиться» внизу: квадрат со стрелкой. |
| share_bar | Дарек сабындагы «Поделиться» баскычын басыңыз. | Нажмите кнопку «Поделиться» в адресной строке. |
| sheet | Тизмени ылдый жылдырып, «На экран Домой» дегенди басыңыз. | Пролистайте список и нажмите «На экран „Домой“». |
| add | Жогорку оң бурчтагы «Добавить» баскычын басыңыз. | Нажмите «Добавить» в правом верхнем углу. |
| menu_dots | Жогорку оң бурчтагы үч чекитти басыңыз. | Нажмите три точки в правом верхнем углу. |
| menu_install | «Установить приложение» дегенди тандаңыз. Кээ бир телефондордо ал «Добавить на главный экран» деп аталат. | Выберите «Установить приложение». На некоторых телефонах — «Добавить на главный экран». |
| install | «Установить» баскычын басыңыз. | Нажмите «Установить». |
| home | Даяр! Башкы экранда «Медресе» белгиси пайда болду. | Готово! На главном экране появился значок «Медресе». |
| opened | Аны басыңыз, тиркеме кадимки колдонмодой толук экранда ачылат. | Нажмите на него — приложение откроется на весь экран, как обычное. |

Данные: стенд `e2e/fixtures/seed.py`, на экране только страница входа, реальных имён нет.

Проверка носителем языка: требуется
