# Видео: Нерабочие дни — внести каникулы, изменить и удалить
feature: non-working-days · role: rector · version: 1.1.0 · device: desktop
Длительность: ~80 с

## Шаги
```yaml
- id: 1
  action: login
  value: rector
  pause: 1.0
  say: intro
- id: 2
  action: click
  target: role=link[name="@nav.non_working_days"]
  pause: 1.0
  say: open
- id: 3
  action: click
  target: main >> role=button[name="@common.add"]
  pause: 0.8
  say: add
- id: 4
  action: fill
  target: role=dialog >> label=@non_working_days.name
  value: {ky: "Кышкы каникул", ru: "Зимние каникулы"}
  pause: 0.5
  say: name
- id: 5
  action: fill
  target: role=dialog >> label=@non_working_days.start
  value: '2026-12-28'
  pause: 0.6
  say: start
- id: 6
  action: fill
  target: role=dialog >> label=@non_working_days.end
  value: '2026-12-31'
  pause: 0.6
  say: end
- id: 7
  action: click
  target: role=dialog >> role=button[name="@common.save"]
  pause: 0.8
  say: save
- id: 8
  action: highlight
  target: {ky: 'tr:has-text("Кышкы каникул")', ru: 'tr:has-text("Зимние каникулы")'}
  pause: 1.2
  say: listed
- id: 9
  action: click
  target: {ky: 'tr:has-text("Кышкы каникул") >> role=button[name="@common.edit"]', ru: 'tr:has-text("Зимние каникулы") >> role=button[name="@common.edit"]'}
  pause: 0.8
  say: edit
- id: 10
  action: fill
  target: role=dialog >> label=@non_working_days.start
  value: '2026-12-26'
  pause: 0.6
  say: edit_date
- id: 11
  action: click
  target: role=dialog >> role=button[name="@common.save"]
  pause: 1.0
  say: edit_save
- id: 12
  action: click
  target: {ky: 'tr:has-text("Кышкы каникул") >> role=button[name="@common.remove"]', ru: 'tr:has-text("Зимние каникулы") >> role=button[name="@common.remove"]'}
  pause: 0.8
  say: delete
- id: 13
  action: highlight
  target: role=dialog >> text=@non_working_days.delete_confirm
  pause: 0.8
  say: confirm
- id: 14
  action: click
  target: role=dialog >> role=button[name="@common.remove"]
  pause: 1.0
- id: 15
  action: wait
  pause: 1.5
  say: outro
```

## Озвучка
| ключ | ky (кыргызча) | ru |
|---|---|---|
| intro | Майрамдарды жана каникулдарды кантип киргизүүнү көрсөтөбүз. Бул күндөрү сабак калтырылган деп эсептелбейт. | Покажем, как внести праздники и каникулы. Уроки в эти дни не считаются пропущенными. |
| open | Менюдан «Иш эмес күндөр» бөлүмүн ачыңыз. Бул бөлүм ректордо гана бар. | Откройте в меню «Нерабочие дни». Этот раздел есть только у ректора. |
| add | «Кошуу» баскычын басыңыз. | Нажмите «Добавить». |
| name | Аталышын жазыңыз. | Впишите название. |
| start | «Башталышы» — биринчи эс алуу күнү. | «Начало» — первый нерабочий день. |
| end | «Аягы» — акыркы эс алуу күнү. Бир эле күн болсо, ошол эле датаны коюңуз. | «Конец» — последний нерабочий день. Если день один, поставьте ту же дату. |
| save | «Сактоо» баскычын басыңыз. | Нажмите «Сохранить». |
| listed | Жазуу тизмеге кошулду. Бул күндөр бардык кафедралар үчүн жалпы. | Запись появилась в списке. Эти дни общие для всех кафедр. |
| edit | Датаны оңдоо үчүн «Өзгөртүү» баскычын басыңыз. | Чтобы поправить даты, нажмите «Изменить». |
| edit_date | Жаңы датаны коюңуз. | Укажите новую дату. |
| edit_save | Анан «Сактоо». | Затем «Сохранить». |
| delete | Жазуу ашыкча болсо, «Өчүрүү» баскычын басыңыз. | Если запись лишняя, нажмите «Удалить». |
| confirm | Суроого дагы «Өчүрүү» деп жооп бериңиз. | На вопрос снова ответьте «Удалить». |
| outro | Өчүрүлгөн күндөрдүн сабактары кайра кадимкидей эсептелет. Өтүп кеткен майрамдарды да киргизип коюңуз. | Уроки этих дней снова считаются как обычно. Внесите и праздники, которые уже прошли. |

Данные: стенд `e2e/fixtures/seed.py` — нерабочих дней на стенде нет, список сначала пустой; «Кышкы каникул» / «Зимние каникулы» 28.12–31.12.2026 (после правки 26.12–31.12.2026) — выдуманная запись, без названий религиозных праздников и без толкования. Шаг 3: у пустого списка своя кнопка «Кошуу» в подсказке, локатор берёт первую — кнопку страницы (как в e2e AC-2.1). Реальных имён нет.

Проверка носителем языка: требуется
