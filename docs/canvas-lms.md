# Canvas LMS (canvas.yu.edu.kz) — техническая документация для Aristos

> Документ для будущих сессий разработки студенческого дашборда Aristos.
> **Все факты, кроме явно помеченных «[гипотеза]», проверены на живом аккаунте студента 03.11.2026.**
> Инстанс: `https://canvas.yu.edu.kz` (Canvas LMS от Instructure, казахстанский университет).
> В документе нет паролей и токенов — только форматы и пути.

---

## 1. Общее

| Параметр | Значение |
|---|---|
| Продукт | Canvas LMS (Instructure), самохостед/облако университета |
| Origin | `https://canvas.yu.edu.kz` |
| API-база | `https://canvas.yu.edu.kz/api/v1/...` |
| Официальная справка API | https://canvas.instructure.com/doc/api/ (эндпоинты совпадают) |
| Версия API | `/api/v1/` (v2 нет) |

Ключевые факты:

- Веб-интерфейс Canvas — SPA, который дергает **те же `/api/v1/` эндпоинты**, что доступны и нам. Всё, что видишь в браузере, можно получить из API под живой сессией.
- **URL объектов в вебе совпадают с ID API**: страница задания `/courses/1526/assignments/167051` = `GET /api/v1/courses/1526/assignments` → элемент с `id: 167051`, `course_id: 1526`. ID из URL можно смело использовать в API и наоборот.
- Формат дат везде — **UTC ISO-8601** (`2026-10-24T14:00:00Z`). Локальное время Астаны = UTC+5.

---

## 2. Аутентификация — три пути, работает только один

| Путь | Статус | Примечание |
|---|---|---|
| Personal Access Token | **ЗАПРЕЩЁН** | Не использовать |
| Живая сессия (cookie + CSRF) | **РАБОТАЕТ** | Основной путь Aristos |
| OAuth2 developer key | Нереалистичен | Нужен админ университета |

### 2.1. Personal Access Tokens — ЗАПРЕЩЕНЫ

- В вебе: Account (Аккаунт) → Settings (Настройки) → «Новый маркер доступа».
- Инстанс возвращает: **«Ваши администраторы Canvas решили ограничить…»** — создание токенов заблокировано политикой инстанса. **Проверено.**
- Вывод: любые скрипты на токенах (`Authorization: Bearer ...`) не заработают у студентов. Не тратить время.

### 2.2. Живая сессия — основной путь

Запрос под браузерной сессией пользователя:

1. **Session cookie** — обычная сессионная кука Canvas (HttpOnly), браузер прикладывает сам при `credentials: 'include'` (или `'same-origin'` на самом canvas).
2. **CSRF-заголовок** — `X-CSRF-Token`. Токен лежит в JS-читаемой куке `_csrf_token` (не HttpOnly) — достаётся `document.cookie` / `chrome.cookies.get`, либо из глобала `window.ENV.csrfToken` на любой странице Canvas.

```js
// На canvas.yu.edu.kz (content script / userscript) — same-origin, CORS нет:
const csrf = window.ENV?.csrfToken
  ?? (document.cookie.match(/_csrf_token=([^;]+)/) ? decodeURIComponent(RegExp.$1) : null)

const res = await fetch('/api/v1/users/self', {
  credentials: 'same-origin',           // на самом canvas; в MV3 SW — 'include'
  headers: { Accept: 'application/json', 'X-CSRF-Token': csrf },
})
```

- Same-origin JS на `canvas.yu.edu.kz` (content script/userscript) работает **без CORS-проблем** — это проверено и является базой userscript-синка.
- GET-запросы к API обычно проходят и без `X-CSRF-Token`, но **всегда отправляй его** — часть роутов и любые POST/PUT отклонятся без него.
- Сессия конечна: при истечении API отвечает `401` → пользователю нужно перезайти в Canvas.

### 2.3. OAuth2 developer key

- `GET /api/v1/login/oauth2/auth` и т.д. требует **developer key, регистрируемого админом университета**. Для студенческого проекта нереалистично. Не закладывать в архитектуру.

---

## 3. CORS — почему нужен extension/userscript

- **Canvas НЕ отдаёт `Access-Control-Allow-Origin` на API-роутах** — проверено `curl` (в ответе нет CORS-заголовков для чужих origin). **Проверено.**
- Следствие: прямой `fetch()` из PWA (localhost / другой домен) на `https://canvas.yu.edu.kz/api/v1/...` **блокируется браузером**, как бы ни формировались заголовки. Обход через `mode: 'no-cors'` даёт opaque-ответ — бесполезен.
- **ICS-фид тоже без CORS** (см. раздел 5).
- Вывод: доступ к Canvas возможен только из контекста, где CORS не действует:
  1. **MV3-расширение** с `host_permissions: ["https://canvas.yu.edu.kz/*"]` — fetch из background service worker идёт с расширенными правами (реализовано, см. раздел 8);
  2. **userscript** (Tampermonkey), работающий на самом `canvas.yu.edu.kz` — same-origin;
  3. [гипотеза] серверный прокси с релайдом сессии — не рассматриваем, хранить чужую сессию нельзя.

```bash
# Проверка отсутствия CORS (ответ без Access-Control-Allow-Origin):
curl -sI "https://canvas.yu.edu.kz/api/v1/users/self" -H "Origin: https://example.com"
```

---

## 4. Ключевые эндпоинты

Все GET, JSON, под живой сессией (см. 2.2). Пагинация и rate limit — в конце раздела.

### 4.1. Список курсов

```
GET /api/v1/courses?enrollment_state=active&include[]=total_scores&per_page=100
```

| Поле элемента | Что это |
|---|---|
| `id` | числовой ID курса (совпадает с URL `/courses/1526`) |
| `name` | полное название; у этого инстанса код курса часто в скобках в конце: `"Математика (MATH101)"` |
| `course_code` | короткий код (заполнен не всегда) |
| `enrollments[].grades.current_score/current_grade` | **ВНИМАНИЕ: на этом инстансе часто НЕ приходят** — `current_score` бывает `null` даже при активной оценке. Не полагаться, см. 4.2. |
| `is_favorite`, `term`, `uuid` | вспомогательные |

`enrollment_state=active` отфильтровывает архивные/завершённые курсы — для семестра это то, что нужно.

### 4.2. Enrollments — надёжный источник итоговых баллов

```
GET /api/v1/users/self/enrollments?include[]=total_scores&per_page=100
```

**На этом инстансе это единственный стабильный источник итоговых оценок по курсу.** Каждый элемент:

```json
{
  "course_id": 1526,
  "grades": {
    "current_score": 87.5,       // итоговый % по курсу
    "current_grade": "3.44",     // GPA-выражение у этого инстанса
    "final_score": 87.5
  },
  "enrollment_state": "active",
  "type": "StudentEnrollment"
}
```

- Брать `enrollments[].course_id` → `grades.current_score` (число) и `grades.current_grade` (строка).
- Собрать в `Map<course_id, {current_score, current_grade}>` и наложить на результат 4.1 — так делает `fetchGradeMap()` в `extension/background.js`.
- У одного курса может быть >1 enrollment (например, тестовый студент) — фильтруй по `type: 'StudentEnrollment'` / бери первый с числовым `current_score`.

### 4.3. Задания и тесты курса

```
GET /api/v1/courses/:id/assignments?include[]=submission&order_by=due_at&per_page=100
```

Возвращает **все задания и тесты курса** (и опубликованные материалы, заведённые как задания). Ключевые поля:

| Поле | Описание |
|---|---|
| `id` | ID задания; `course_id` — ID курса |
| `name` | название (например, «РК1 Емтихан», «Тапсырма 3 неделя (CN101)») |
| `due_at` | дедлайн, **UTC ISO**; `null` у материалов без дедлайна |
| `points_possible` | максимум баллов |
| `submission_types` | массив: `online_quiz`, `online_upload`, `online_text_entry`, `discussion_topic`, `none`… |
| `is_quiz_assignment` | `true` для тестов (quiz) |
| `published` | `false` = черновик — **пропускать** |
| `html_url` | ссылка на страницу задания в вебе |
| `submission` | только при `include[]=submission` — сдача текущего студента |

`submission`:

| Поле | Описание |
|---|---|
| `score` / `grade` | балл/оценка (null до проверки) |
| `submitted_at` | UTC ISO момента сдачи |
| `graded_at` | UTC ISO момента проверки; есть ⇒ оценено |
| `workflow_state` | `submitted` / `graded` / `unsubmitted` |
| `late`, `missing` | булевы флаги Canvas |

### 4.4. Planner — общий фид «что происходит»

```
GET /api/v1/planner/items?per_page=50
```

Единая лента заданий, тестов и объявлений по всем курсам. Полезен для «сегодня/скоро» без обхода курсов:

| Поле | Пример |
|---|---|
| `context_type` / `course_id` | `Course` / `1526` |
| `context_name` | `"Математика (MATH101)"` — **код курса в скобках внутри названия** |
| `plannable_type` | `assignment` \| `quiz` \| `announcement` |
| `plannable_id` | ID объекта (= ID задания при `assignment`) |
| `plannable_date` | дата события (due_at для заданий) |
| `html_url` | ссылка |
| `submissions` | `{ submitted, graded, late, posted_at, excused }` |

### 4.5. Профиль

```
GET /api/v1/users/self
```

→ `{ id, name, login_id, ... }`. Использовать для проверки живости сессии и приветствия.

### 4.6. Пагинация

- Заголовок ответа `Link` со ссылкой на следующую страницу: парсить `<url>; rel="next"` (регэксп `/<([^>]+)>;\s*rel="next"/`).
- `per_page` — максимум **100**.
- Ссылка из `Link` абсолютная — подставлять её в fetch целиком.
- Защита от вечного цикла: ограничивать число страниц (в коде Aristos — 50).

```js
const next = res.headers.get('Link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null
```

### 4.7. Rate limit

- Заголовок `x-rate-limit-remaining` в каждом ответе, у живой сессии около **600** (токен-бюджет).
- [гипотеза] При исчерпании Canvas начинает отвечать 403 с `X-Rate-Limit-Remaining: 0` и требованием ожидания. Синк Aristos делает ~N курсов + 2 запроса и с запасом в лимит не упирается; но при отладке не ставь запросы в тугой цикл.

---

## 5. ICS-фид календаря

- URL: `https://canvas.yu.edu.kz/feeds/calendars/user_<TOKEN>.ics`
- Где взять: Календарь (Calendar) → «Канал календаря» / «Calendar Feed» → ссылка с персональным токеном. Регенерация токена: кнопка «Сбросить фид» там же.
- **Токен в URL — фактически пароль**: даёт весь календарь без логина. **Не публиковать, не коммитить, не логировать.**
- Ограничения (проверено):
  - Даты **БЕЗ ВРЕМЕНИ**: `DTSTART;VALUE=DATE:20261024` — дедлайн известен только датой, время потеряно.
  - Нет статусов сдачи (submitted/graded/late) — только события.
  - Генерится фоновым джобом Canvas — **может отставать** от реальных данных на минуты-часы.
  - Без CORS — из PWA напрямую не прочитать.
- Вывод: использовать **только как запасной канал** (например, подписка в Google Calendar для уведомлений), не как источник данных дашборда. Основной источник — API через расширение.

---

## 6. Схема оценивания университета

Подтверждено сравнением оценок Canvas с Платонусом (03.11.2026).

| Компонент | Как выглядит в Canvas |
|---|---|
| Еженедельные тесты | «лекции» — задания типа quiz по неделям |
| Практики | обычные assignments с баллами |
| БӨЖ / СӨЖ | задания, усредняются по периодам |

Формула (семестр):

```
РК1     = среднее за недели до рубежного контроля   (осень 2026: до 24 октября)
РК2     = среднее за недели после РК1
Рейтинг = (РК1 + РК2) / 2
Итог    = round(0.6 × Рейтинг + 0.4 × Экзамен)
```

- Даты рубежек фиксированы деканатом и **могут меняться по семестрам** — хранить в конфиге, не хардкодить (осень 2026: РК-граница 24.10).
- **Экзамен приходит в Canvas обычным заданием** со словами «Емтихан» / «Экзамен» в названии — искать по названию, отдельного типа нет. [гипотеза] до публикации результатов у экзамена `points_possible` есть, а `submission.score` — null.
- Границы недель / вес компонентов внутри Canvas-групп задаёт преподаватель; приведённая формула — университетская модель, которой следуют итоговые числа.

---

## 7. Кванты и подводные камни

1. **due_at всегда UTC.** Сравнивать даты только в одном фрейме (все → UTC+5 или все → Date-объекты). Сравнение «дедлайна-строки» с локальной датой даёт **сдвиг на день** — классический баг «задание просрочено вчера», хотя сдаётся сегодня.
2. **`published: false` — пропускать.** Черновики видны API, но студенту не показываются.
3. **Определение типа** (порядок проверок важен):

```js
function itemType(a) {
  const t = a.submission_types || []
  if (a.is_quiz_assignment || t.includes('online_quiz')) return 'quiz'
  if (t.includes('discussion_topic'))                    return 'discussion'
  if (t.includes('none') || t.length === 0)              return 'other'
  return 'assignment'
}
```

4. **Учителя оформляют курсы по-разному**: кто-то модулями по неделям, кто-то страницами, кто-то гуглодоками-ссылками. На дедлайны/оценки это не влияет — это единые объекты API; отличие только в наличии/отсутствии `due_at` у «материалов».
5. **Много материалов без дедлайна**: 169 из 233 заданий имеют `due_at: null` (лекции, материалы). Для раздела «Дедлайны» фильтровать `due_at != null`; остальное — в «Материалы».
6. **Оценки итоговые — из enrollments** (4.2), не из `courses?include[]=total_scores` (4.1).
7. **«Мок» данных нет** — всё, что приходит, реальные объекты инстанса (реальные курсы вида «CN101», реальные 200+ заданий). Тестовые фикстуры собирать руками, а не «синтетикой по мотивам».
8. `context_name` в planner и `name` курса содержат код в скобках — код достаётся регэкспом `/\(([^()]+)\)\s*$/` (как в `extractCode()`).

---

## 8. Архитектура синка Aristos (как реализовано)

Два клиента под живой сессией, PWA получает готовый payload. **PWA сама к Canvas не ходит никогда** (CORS, раздел 3).

```
[canvas.yu.edu.kz API]
        │  fetch + session cookie + X-CSRF-Token (CORS нет — но host_permissions/same-origin)
        ▼
extension/background.js (MV3 service worker)   ИЛИ   userscript/aristos-sync.user.js (Tampermonkey)
        │  нормализация
        ▼ payload {format:'aristos-canvas-sync', version:1, ...}
        ├── FAST: window.postMessage → CanvasSyncListener (ack 'aristos-canvas-sync-result')
        └── RELIABLE: localStorage['aristosCanvasSync'] → polling 8с в PWA
        ▼
PWA: applyCanvasSync() — атомарно заменяет сторы canvasCourses / canvasAssignments
```

### 8.1. Расширение `extension/` (основной путь)

- **MV3**, `manifest.json`: `permissions: ["cookies","scripting","storage"]`, `host_permissions: ["https://canvas.yu.edu.kz/*"]`, `optional_host_permissions` — на адрес дашборда (даётся через popup, `chrome.permissions`).
- **background.js** (service worker):
  - CSRF: `chrome.cookies.get({url:'https://canvas.yu.edu.kz/', name:'_csrf_token'})` → `decodeURIComponent`.
  - fetch с `credentials:'include'` + `X-CSRF-Token`; 401 → «сессия истекла», 403 → понятное сообщение.
  - Порядок сбора: `courses` (4.1) → `enrollments` (4.2, карта оценок) → по каждому курсу `assignments` (4.3), `published:false` пропускаются.
  - `pushToAristos`: находит/открывает вкладку дашборда, пишет `localStorage.aristosCanvasSync` через `chrome.scripting.executeScript` (надёжный путь), параллельно в `world:'MAIN'` гоняет postMessage с ретраем каждые 1.5с и ожидает ack `aristos-canvas-sync-result` (быстрый путь). Успех = ack `ok:true` ИЛИ исчезновение ключа из localStorage (значит, приложение его применило).
  - Если push не удался — popup предлагает выгрузить payload **файлом** (ручной импорт).
- Адрес дашборда хранится в `chrome.storage.local.aristosUrl`.

### 8.2. Userscript `userscript/` (альтернатива для Tampermonkey)

- `@match https://canvas.yu.edu.kz/*`, `@grant none` — то же самое для тех, у кого нет extension.
- CSRF из `window.ENV.csrfToken` или куки `_csrf_token`; fetch `credentials:'same-origin'`.
- Кнопка «Aristos Sync» на страницах Canvas; адрес дашборда — `localStorage.aristos_sync_url` на canvas (правый клик по кнопке); доставка — postMessage в открытую вкладку Aristos.

### 8.3. Формат payload (контракт версий)

```jsonc
{
  "format": "aristos-canvas-sync",
  "version": 1,
  "syncedAt": "2026-11-03T09:15:00.000Z",
  "source": "extension",            // | "userscript" | "file"
  "courses": [
    { "id": 1526, "name": "Математика (MATH101)", "code": "MATH101",
      "current_score": 87.5, "current_grade": "3.44" }
  ],
  "assignments": [
    { "id": 167051, "course_id": 1526, "title": "Тапсырма 3 неделя", "type": "assignment",
      "due_at": "2026-10-24T14:00:00Z", "points_possible": 10,
      "html_url": "https://canvas.yu.edu.kz/courses/1526/assignments/167051",
      "submitted_at": null, "score": null, "graded": false, "late": false, "missing": false }
  ]
}
```

- Валидация в PWA: `isCanvasSyncPayload()` (`src/lib/canvas.ts`) проверяет `format`/`version` и поля — чужие сообщения отбрасываются.
- При смене контракта поднимать `version` и учить валидатор принимать старые.

### 8.4. Приём в PWA

- `src/components/layout/CanvasSyncListener.tsx` (глобально):
  - **postMessage**: принимает только с `event.origin` из `CANVAS_SYNC_ORIGINS` = `['https://canvas.yu.edu.kz', location.origin]`; после применения шлёт ack `{type:'aristos-canvas-sync-result', ok, error?}` и удаляет `localStorage`-ключ (чтобы тот же payload не применился дважды).
  - **localStorage-handoff**: ключ `aristosCanvasSync`; проверка на mount, по `visibilitychange`/`focus` и **polling каждые 8с**; ключ забирается первым делом (`removeItem`), чтобы ошибка не зациклилась.
  - Тост об успехе: «Canvas синктелді: N курс, M тапсырма».
- `syncCanvas(payload)` (`src/hooks/useDB.ts`) → `applyCanvasSync()` (`src/lib/canvas.ts`) — **заменяет сторы `canvasCourses` и `canvasAssignments` целиком** (не merge).
- Маппинг course → предмет: ручной (`canvasCourseMap`, настройка в IndexedDB через `CourseMappingModal`) + автопоиск по названию (`buildAutoCourseMap`): код в скобках / совпадение названия.
- Потребители: `UpcomingDeadlines`, `DeadlinesPage`, `CanvasGradesCard`.

---

## 9. Чеклист «если что-то не работает»

| Симптом | Причина / действие |
|---|---|
| **401** от любого эндпоинта | Сессия Canvas истекла — перезайти в `canvas.yu.edu.kz`, повторить синк. (Токены не при чём — их тут нет.) |
| Пустые `current_score` у курсов | Так и бывает на этом инстансе: брать `GET /users/self/enrollments?include[]=total_scores` и накладывать карту оценок (4.2) |
| **Push не доходит** до PWA | 1) Проверить `host_permissions` на canvas И optional-permission на origin дашборда (пересохранить адрес в popup). 2) Проверить localStorage-handoff: в DevTools дашборда `localStorage.getItem('aristosCanvasSync')` — если ключ есть и висит >60с, вкладка спит/не смонтирован листенер — обновить вкладку (F5). 3) Убедиться, что origin вкладки входит в `CANVAS_SYNC_ORIGINS`. |
| postMessage игнорируется | `event.origin` не в списке, либо payload не прошёл `isCanvasSyncPayload` (смотреть warn в консоли PWA) |
| CORS-ошибка при fetch к canvas | Синк запущен не из extension/userscript — PWA напрямую ходить не должна (раздел 3) |
| «Ваши администраторы Canvas решили ограничить…» | Попытка создать Personal Access Token — путь закрыт, использовать живую сессию |
| Дедлайны «на день раньше/позже» | Смешение UTC и локального времени — привести всё к одному фрейму (раздел 7.1) |
| Мало заданий | Проверить пагинацию `Link: rel="next"` и что не отфильтровали `published:false` вместе с нужным; часть заданий легитимно без `due_at` (169/233) |
| ICS отстаёт от API | Это норма: фид генерится фоновым джобом; для точных статусов — только API |
| 403 на API при живой сессии | Либо rate-limit (проверить `x-rate-limit-remaining`), либо конкретный роут запрещён админами — логировать path и идти дальше, не ронять весь синк |

---

## 10. Быстрая проверка окружения (для будущих сессий)

```bash
# 1. Сессия живая? (выполнить в консоли DevTools на canvas.yu.edu.kz)
fetch('/api/v1/users/self', {credentials:'same-origin',
  headers:{'X-CSRF-Token': window.ENV.csrfToken}})
  .then(r => r.json()).then(console.log)
# → {id, name, ...} = сессия ок; 401 = перезайти

# 2. Итоговые оценки
fetch('/api/v1/users/self/enrollments?include[]=total_scores&per_page=100',
  {credentials:'same-origin', headers:{'X-CSRF-Token': window.ENV.csrfToken}})
  .then(r => r.json()).then(console.log)

# 3. Пагинация/rate limit — смотреть заголовки ответа:
#    Link: <https://canvas.yu.edu.kz/api/v1/...&page=2>; rel="next"
#    x-rate-limit-remaining: ~600
```

Код синка: `extension/background.js`, `userscript/aristos-sync.user.js`, приём в PWA: `src/lib/canvas.ts`, `src/components/layout/CanvasSyncListener.tsx`, `src/hooks/useDB.ts`.
