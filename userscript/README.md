# Aristos Sync — userscript для Canvas

> **Внимание:** теперь основной путь — [браузерное расширение](../extension/README.md)
> (не требует Tampermonkey, ставится за 2 минуты). Этот userscript оставлен как альтернатива.

Тянет дедлайны и оценки из `canvas.yu.edu.kz` под твоей живой сессией (токены в этом университете
запрещены, но same-origin скрипту они не нужны — хватает session cookie + CSRF из куки).

## Установка

1. Поставь [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Edge/Firefox).
2. Tampermonkey → «Создать новый скрипт» → вставь содержимое `aristos-sync.user.js` → Сохранить.
   (или перетащи файл на страницу настроек Tampermonkey)
3. Открой `canvas.yu.edu.kz` — внизу справа появится синяя кнопка **Aristos Sync**.

## Настройка адреса Aristos

Правый клик по кнопке → вводишь URL дашборда:

- dev: `http://localhost:5173`
- прод: твой задеплоенный адрес (например `https://aristos.vercel.app`)

Адрес сохраняется в `localStorage` Canvas (кнопка → правый клик → сменить можно всегда).

## Как это работает

1. Кнопка «Aristos Sync» → скрипт фетчит:
   - `GET /api/v1/courses?enrollment_state=active&include[]=total_scores` — курсы + итоговый балл;
   - `GET /api/v1/courses/:id/assignments?include[]=submission` — все задания/тесты со статусами.
2. Собирает payload формата `aristos-canvas-sync` и открывает вкладку Aristos,
   куда передаёт данные через `postMessage` (ждёт ack от приложения).
3. Если push не удался (вкладка не открылась, попапы заблокированы) — скачивает
   `canvas-sync-YYYY-MM-DD.json`, который импортируется через «Деректерді импорттау» в Aristos.

Синк не автоматический — жмёшь кнопку, когда хочешь обновить данные. Автосинк по таймеру
добавим позже (или переехав на MV3-расширение + Cloudflare Worker).
