# Aristos Desktop / Android (Tauri) — техническая документация

> Документ для разработки и сопровождения Tauri-версии Aristos. Дополняет
> `CONTEXT.md` (краткий контекст проекта) и лендинг `aristoslanding.vercel.app/docs/tauri`
> (пользовательское описание). Все факты — из кода репозитория.
> Версия: **0.1.4** (0.1.1–0.1.3 не работали — крэш конфига, см. §4.3).
> Tauri 2 (`@tauri-apps/api` 2.12, CLI 2.12). Identifier: `kz.yessenov.aristos`.

---

## 1. Общая картина

Aristos — один фронтенд (Vite + React 19 + TS + Tailwind 4), три дистрибуции:

| | **PWA** (Vercel, `aristoss.vercel.app`) | **Desktop** (Tauri: Linux/Win/macOS) | **Android** (Tauri APK, sideload) |
|---|---|---|---|
| Оболочка | браузерная вкладка + Service Worker | системный webview (WebKitGTK / WebView2 / WKWebView) | Android WebView |
| Синк Canvas/Платонус | MV3-расширение (`extension/`) | **нативный v2** (§3): Canvas — Rust+reqwest, Платонус — webview-инжект | нет нативного синка — данные через **облако** (NativeSyncSection скрыта на мобильных) |
| Напоминания | in-app агент (NotificationAgent) | in-app агент через нативный плагин | **запланированные** (работают при закрытом приложении) + утренний дайджест |
| Виджеты | — | — | **3 виджета** (RemoteViews, адаптивная тёмная/светлая палитра) |
| Обновления | — | tauri-plugin-updater (подпись minisign) | one-tap: APK в кеш → системный установщик (§4.4) |
| PDF | `window.open(blob)` | роут `/pdf/:id` (pdfjs) | роут `/pdf/:id` (WebView не рендерит PDF) |

iOS нативно не делается — там работает PWA («на экран Домой»).

Ключевой принцип миграции: **фронт тот же билд** (`vite build` → `dist/`,
`tauri.conf.json → frontendDist: ../dist`), Tauri — только обёртка + нативные
фичи. Вся платформо-специфичная логика фронтенда расходится по гейтам
`isTauri()` / `isTauriMobile()`.

### Что изменилось по сравнению с PWA

1. **Синк без расширения (desktop).** Canvas собирается нативно в Rust из
   кук webview; Платонус — DOM-harvest в webview-окне, доставка через
   канал заголовка. Нет CORS-ограничений расширения и нет троттлинга
   MV3-воркера. На Android нативного синка нет — данные через облако.
2. **Роутер.** В Tauri — `HashRouter` (path-роутинг под кастомным протоколом
   ненадёжен), на вебе — прежний `BrowserRouter` (`src/App.tsx:18`).
3. **Уведомления.** Транспорт — `@tauri-apps/plugin-notification` вместо
   Web Notification API; на Android добавляется планирование на неделю
   вперёд, дайджест дня, группировка в шторке.
4. **Виджеты Android** — данные через JSON-снапшот в файл приложения.
5. **PDF.** Android WebView не рендерит PDF → встроенный просмотрщик
   `/pdf/:id` на pdfjs-dist.
6. **Канал обновлений** — desktop: тихая установка с проверкой подписи;
   Android: скачивание APK и системный установщик в один тап.
7. **База данных та же** — IndexedDB `aristos_db`, бекапы/JSON-конфиги/
   облачный синк полностью совместимы с PWA.

---

## 2. Детект рантайма и точки ветвления

`src/lib/tauri.ts`:

```ts
isTauri()        // "__TAURI_INTERNALS__" in window — true только в Tauri-обёртке
isTauriMobile()  // isTauri() && /Android|iPhone|iPad/i.test(UA)
```

Где гейты расставлены:

| Место | Условие | Поведение |
|---|---|---|
| `src/App.tsx` | `isTauri()` | `HashRouter` вместо `BrowserRouter` |
| `SideMenu.tsx:408` (NativeSyncSection) | `isTauri() && !isTauriMobile()` | секция нативного синка видна только на **desktop**-Tauri |
| `SideMenu.tsx:411` (UpdateSection) | `isTauri()` | секция обновлений — весь Tauri |
| `NotificationAgent.tsx` | `isTauriMobile()` | ветка мобильной Tauri: `refreshNativeReminders` + `pushWidgetSnapshot` |
| `src/lib/reminders.ts` | `isTauriMobile()` | планирование нативных напоминаний (на десктопе плагин доставил бы «запланированное» немедленно — поэтому там only in-app агент) |
| `src/lib/widget-snapshot.ts` | `isTauri()` | push снапшота для виджетов (на десктопе Rust-команда no-op) |
| `src/lib/notifications.ts` | `isTauri()` | транспорт плагина vs Web Notification API |
| `src/pages/...` (UploadedPdfs) | `isTauri()` | навигация на `/pdf/:id` вместо `window.open(blob:)` |

---

## 3. Нативный синк v2 (11.11) — замена расширения

### 3.1 Почему v2

Remote-IPC с внешних страниц (v1: инжект-скрипты звали
`window.__TAURI__.core.invoke('sync_payload')` через capability `remote-sync`)
оказался ненадёжен — сообщения периодически не доходили, синк висел на
спиннере. Пере-архитектура: **Canvas убран из webview вообще** (чистый Rust),
**Платонус перешёл на доставку через заголовок окна**. Команда `sync_payload`
и `capabilities/remote-sync.json` остались в коде как задел — драйвер их
больше не использует.

### 3.2 Canvas — полностью в Rust (`src-tauri/src/canvas.rs`)

Сессия берётся из **cookie-jar webview** (общий у всех окон; юзер логинится
в видимом окне приложения — куки персистентны между запусками). Запросы
делает reqwest с заголовками `Cookie` + `X-CSRF-Token` (кука `_csrf_token`,
percent-decode). Инжект-скрипт `canvas-collector.js` **удалён**.

Обе команды — `async`: синхронная `cookies()` внутри запроса документированно
deadlock'ает на Windows.

| Команда | Назначение |
|---|---|
| `canvas_session_state` | `{hasSession, cookieCount}`; hasSession = в куках есть `_csrf_token` |
| `canvas_sync_native` | полный сбор → `{data: payload, scoresMissing, scoresDiag}`; `Err("need-login")` — сессии нет/истекла |

Механика `canvas_sync_native` (порт userscript-коллектора):

- `/api/v1/courses?enrollment_state=active&include[]=total_scores&include[]=enrollments&per_page=100`;
- пагинация по `Link`-заголовку (`rel="next"`), лимит **50 страниц**;
- `/api/v1/courses/{id}/assignments?include[]=submission&order_by=due_at` —
  провал одного курса не роняет синк (как в userscript); `published=false`
  пропускается;
- **оценки курсов** (вуз вынес итоги в LTI-тул, грейдбук отдаёт `null`):
  `/users/self/enrollments` — до **3 попыток** с паузами 1.5с/3с (неудача —
  и ошибка, и «200 без оценок»), затем **per-course фолбэк**
  `/courses/{id}/enrollments`; терпимый парсинг (строка-число тоже годится);
  итог — `scoresMissing` + строка `scoresDiag` (мягкий сбой, синк успешен);
- нормализация в Rust: `item_type` (quiz/discussion/other/assignment по
  submission_types), `extract_code` (код из `(…)` в конце названия),
  сбор `lock_at` («Доступно до» — фронт считает дедлайном через
  `effectiveDeadline()`), submission-поля (submitted_at/score/graded/
  late/missing).

### 3.3 Платонус — webview-инжект + title-канал

DOM-harvest остаётся в инжект-драйвере `src/lib/injected/platonus-page.js`
(парсер карточек v3: полное имя — в `title`-атрибуте, донут — `data-percent`,
пары «значение / подпись» — из футера, `data-id` = subjectID; оценки по дням —
кликами по карточкам + съём `#marksModal`; режимы `discover`/`harvest`;
параметры через `window.__ARISTOS_PARAMS__`). Август-фикс дат
(`month >= 8 ? year : year+1`) в порту.

Доставка результата — **канал заголовка окна**:

1. Драйвер шлёт сообщение чанками: `document.title = "ARISTOS_D|idx|total|chunk"`
   (single-chunk — без ожидания ACK).
2. Хост (`waitPlatonusMessage` в `native-sync.ts`) поллит `sync_diag`
   каждые **350 мс**, собирает чанки по idx.
3. Подтверждение чтения — `sync_eval` ставит `window.__ARISTOS_ACK = idx+1`,
   после чего драйвер шлёт следующий чанк (page-side таймаут на ACK).
4. Собранное JSON-сообщение матчится по типу; `progress` уходит в UI, не копясь.
5. Ошибка драйвера — `ARISTOS_E|причина` в title → бросается как есть.

`window.__TAURI__` на внешних страницах больше **не нужен**.

### 3.4 Rust-команды harvest-окна (`src-tauri/src/sync.rs`, `lib.rs`)

| Команда | Назначение |
|---|---|
| `sync_open(url, visible)` | открыть/переоткрыть `harvest`. При смене URL: закрыть и ждать фактического исчезновения лейбла (40 × 50 мс) — против гонки «label already exists». Окно 940×720, «Aristos Sync» |
| `sync_eval(js)` | исполнить JS в harvest (инжект-драйвер, ACK) |
| `sync_url()` | текущий URL harvest — детект конца логина |
| `sync_diag()` | `{url, title}` — хост поллит title-канал и диагностирует отказ |
| `sync_close()` | закрыть harvest |
| `sync_payload(json)` | v1-IPC (эмит `sync-payload` в main) — **задел, драйвером не используется** |
| `write_widget_data(data)` | JSON-снапшот Android-виджетов (§5); вне Android — no-op |
| `download_update(url)` / `install_apk(path)` | канал обновлений (§4.4) |

### 3.5 Права IPC (capabilities / permissions)

- `capabilities/default.json` — окно `main`: `core:default`,
  `notification:default`, `updater:default`, `process:default`,
  `opener:default` + собственные `allow-write-widget-data`,
  `allow-sync-open/eval/url/diag/close`, `allow-sync-payload`,
  `allow-canvas-session-state`, `allow-canvas-sync-native`,
  `allow-download-update`, `allow-install-apk`.
- `capabilities/remote-sync.json` — окно `harvest`, remote-URLs
  canvas/platonus/id.yu.edu.kz → только `allow-sync-payload`. **Задел v1**.
- `permissions/aristos.toml` — ACL собственных команд: каждый `allow-*` =
  `commands.allow` для соответствующей Rust-команды.

### 3.6 Потоки синка

**Canvas** (`runCanvasSync`):
1. Превентивная проверка `canvas_session_state`: мертвая сессия → сразу окно
   логина, а не спиннер до 401.
2. Окно логина `/login/canvas` (видимое) → поллинг `canvas_session_state`
   каждые 1.5 с, лимит **6 мин**.
3. `canvas_sync_native`; `need-login` посреди синка → окно логина и повтор.
4. `payload.syncedAt` проставляется JS → валидация `isCanvasSyncPayload` →
   `useDB().syncCanvas` (тот же путь, что у расширения: React-стейт +
   авто-маппинг + авто-push в облако). `scoresDiag` показывается как
   предупреждение при успехе.

**Платонус** — двухшаговый:
1. **Discover** (`discoverPlatonus`): `/student_register` (hidden) → драйвер
   `mode:'discover'` (таймаут **120 с**) → `studentID` сохраняется в settings
   (`platonusStudentID`), периоды — чекбоксы в UI (предвыбраны все).
2. **Import** (`runPlatonusSync(chosen)`): для каждого периода —
   `/student_register?studentID={id}&year={Y}&term={T}` → драйвер
   `mode:'harvest'` (таймаут **20 мин** — съём оценок кликами долгий) →
   `record`. `need-login` → видимое окно SSO (вход завершён, когда вернулись
   на `platonus.yu.edu.kz` вне `id.yu.edu.kz`/`login`/`oauth`, **два
   стабильных опроса подряд**) → период переигрывается (`i--`). В конце
   payload `aristos-platonus-sync` → валидация → `useDB().syncPlatonus`.

Гейт реентерабельности: `busy` — вторая попытка бросает `sync-already-running`.

### 3.7 UI и ошибки (`NativeSyncSection.tsx`, desktop-Tauri only)

Кнопки: «Canvas синк» → этапы/ошибки текстом; «Найти доступные периоды»
(discover) → чекбоксы `ГГГГ/семестр` → «Импорт выбранных». Прогресс Платонуса:
«период i/N», «оценки по дням idx/total». Ошибки-машины:
`need-login` / `login-timeout` / `sync-already-running` / `sync-timeout` /
`platonus-no-periods` / `platonus-empty` / `*-invalid-payload` + сырые
`ARISTOS_E|…` и `diag-no-window` (harvest закрылся).

**Семантика данных сохранена**: `applyCanvasSync`/`applyPlatonusSync` заменяют
сторы целиком (полный снапшот). Payload `source: 'app'`; поле `lock_at`
добавлено опционально (старые записи переживаются, появится после первого
синка).

---

## 4. Уведомления

### 4.1 Транспорт

`src/lib/notifications.ts`: в Tauri — `@tauri-apps/plugin-notification`
(`isPermissionGranted`/`requestPermission`/`sendNotification`); на вебе/PWA —
Web Notification API (через Service Worker, если доступен). Права в Tauri
асинхронные — синхронно возвращается `default`, UI (SideMenu) уточняет
эффектом. Настройки — `localStorage` (`aristos-notif-settings-v1`):
`lessons`, `deadlines`, `minutesBefore` (по умолчанию 5; выбор
5/10/15/30 в SideMenu), `digest` (утренний дайджест дня, по умолчанию вкл).
Журнал показанного — `aristos-notif-shown-v1`
(`notifyOncePerDay` — в-app тик, чтобы не спамить каждый тик).

### 4.2 Desktop-Tauri

Планирование не используется: плагин на десктопе доставил бы «запланированное»
немедленно. Работает in-app агент `NotificationAgent` (прежняя v0-логика:
пары за `minutesBefore`, дедлайны за 24 ч, дайджест дня с 07:30,
`notifyOncePerDay`), но отправка идёт через нативный плагин.

### 4.3 Android (Tauri mobile) — напоминания при закрытом приложении

`src/lib/reminders.ts` планирует уведомления через `Schedule.at(...)`
на **7 дней вперёд** (`HORIZON_DAYS`), максимум **100 событий**
(`MAX_EVENTS`), при каждом открытии/визибле/синке/смене настроек окно
продлевается: `cancelAll()` + свежий набор (id — детерминированный FNV-1a
хэш ключа `lesson-{дата}-{время}` / `deadline-{id}` — повторное планирование
не плодит дубли).

Отбор повторяет фильтры NotificationAgent:
- **Пары**: дни недели из расписания, уведомление за `minutesBefore` до
  начала; вне семестра и в праздники (`acad_calendar`) — тишина.
- **Дедлайны Canvas**: не сданные (`!submitted_at`), за 24 ч до
  **эффективного дедлайна** (`effectiveDeadline`: due_at → lock_at; если уже
  ближе — через минуту).
- **Дайджест дня**: раз в сутки в 07:30 — одно тихое уведомление со списком
  пар дня (InboxStyle, до 8 строк «09:00 — Пән»), канал `aristos-digest`
  (Default, без вибрации), тумблер `digest` в настройках. На PWA дайджест
  идёт через in-app агент (первый тик дня после 07:30), без InboxStyle.

Контент: заголовок = предмет/название теста (важное первым и обрезается
последним), тело = «Сабақ жақында · 09:00 · аудитория»; `largeBody` —
полная строка в развёрнутой шторке. Группы `aristos-lessons` /
`aristos-deadlines` / `aristos-digest` — однотипные уведомления сворачиваются
в стек (автосводка Android 7+).

Каналы Android: `aristos-lessons` и `aristos-deadlines`
(importance HIGH, вибрация, огни) и тихий `aristos-digest` (Default).
Разрешения манифеста: `POST_NOTIFICATIONS`,
`SCHEDULE_EXACT_ALARM`, `VIBRATE`.

Иконка/акцент: **секция `plugins.notification` в `tauri.conf.json`
запрещена** — Rust-сторона плагина не объявляет конфиг, и любая карта там
валит приложение при старте
(`PluginInitialization("notification", "... invalid type: map, expected
unit")`, panic-abort; так падали 0.1.1–0.1.3). Иконка и цвет задаются на
каждое уведомление из JS: `icon: "ic_notification"` (белый вектор-глиф «A»
в `custom-android/.../res/drawable/`; без него плагин подставляет
системный `ic_dialog_info`) и `iconColor: "#38BDF8"` (setColor) — константы
`NOTIF_ICON`/`NOTIF_ICON_COLOR` в `src/lib/notifications.ts`. Ресурс
защищён от ресурсного шринкера через `res/raw/keep.xml` (`tools:keep`) —
он ссылается только строкой из JS. PWA-путь использует монохромный
`public/icons/notification-badge.png` (белый глиф на прозрачном; прежний
непрозрачный `icon-192.png` Android рисовал белым квадратом).

### 4.4 Канал обновлений (src/lib/app-update.ts)

**Хостинг — sync-воркер** (`https://aristos-sync.aristoss.workers.dev`):

| Endpoint | Доступ | Назначение |
|---|---|---|
| `PUT /api/app/file/:name` | `X-App-Upload-Secret` | бинарник релиза (≤25 МБ, KV) |
| `PUT /api/app/meta` | `X-App-Upload-Secret` | JSON `{version, notes, files}` |
| `GET /api/app/latest` | публично | `{found, version, notes, apkUrl}` |
| `GET /api/app/file/:name` | публично | скачивание (правильный Content-Type) |

Секрет — `APP_UPLOAD_SECRET` в `sync-worker/wrangler.toml` (CI читает его из
этого же файла). После изменения воркера: `cd sync-worker && npx wrangler deploy`.

- **Desktop** — `tauri-plugin-updater`: `latest.json` на воркере
  (endpoint/pubkey в `tauri.conf.json`), `downloadAndInstall` + relaunch.
  Подпись minisign проверяется автоматически. Формат `latest.json` (собирает
  CI job `publish-updates`): платформы `windows-x86_64` (NSIS exe+sig) и
  `darwin-aarch64` (`.app.tar.gz`+sig). **Linux-апдейтер не хостится** —
  AppImage ~100 МБ не влезает в лимит KV 25 МБ (deb обновлять вручную).
- **Android** — апдейтов «без установки» не бывает: любое обновление вне
  магазина — это установка APK поверх (та же подпись — данные сохраняются).
  Схема «в один тап»: баннер в UpdateSection → `installAndroidUpdate` →
  команда `download_update` (reqwest → `app_cache_dir/apk/*.apk`, старые
  версии подчищаются, безопасное имя файла) → команда `install_apk` →
  Kotlin-плагин `UpdaterPlugin` (`register_android_plugin`, custom-android) →
  FileProvider `${applicationId}.aristos.fileprovider`
  (paths: `@xml/aristos_file_paths`, cache/apk) → ACTION_VIEW
  `application/vnd.android.package-archive` → системный установщик.
  Разрешение `REQUEST_INSTALL_PACKAGES` выдаётся пользователем один раз:
  если не выдано, плагин открывает системную страницу этого приложения в
  настройках и отвечает `need-permission` (статус показывается в UI, тап —
  повтор). Фоллбек при отказе прямого пути — открытие APK-URL в браузере,
  как раньше. Баннер появляется только когда версия на канале строго больше
  установленной (`isNewer`) — релиз без bump'а версии телефон не увидит.
- Регистрация Kotlin-плагина **не фатальна** (`install.rs`): если не поднялся,
  приложение работает, `install_apk` отвечает ошибкой → фронт откатывается
  на браузер.
- UI — `UpdateSection.tsx` в SideMenu (весь Tauri): текущая версия
  (`getVersion`) + баннер при новой (проверка на монтировании).
- **Подписи коммитятся в репо** (приватный): APK-keystore
  `src-tauri/keystore/aristos-sign.b64`, minisign-приватный
  `src-tauri/keystore/aristos-updater.b64`, пароль `aristos-sign-2026`.
  Сознательное решение ради стабильной подписи. ⚠️ При переводе репо в
  публичный — вынести в секреты и **сменить ключи** (ротация подписи APK =
  апдейты только с удалением старого). Альтернатива через секреты:
  `ANDROID_KEYSTORE_B64` + `ANDROID_KEYSTORE_PASSWORD`.

Рефреш-триггеры (мобильная ветка `NotificationAgent`): открытие приложения,
visibilitychange, каждые 6 ч, после синков, смена настроек уведомлений.

---

## 5. Виджеты Android (3 шт.)

| Виджет | Размер | Контент |
|---|---|---|
| NextPairs | 4×2 | ближайшие пары («сегодня»/«завтра» + время/аудитория) |
| WeekSchedule | 4×3 | неделя расписания по дням |
| Deadlines | 4×2 | ближайшие дедлайны Canvas |

### Механика (без JNI-плагина)

1. **Фронт** (`src/lib/widget-snapshot.ts`) собирает `WidgetSnapshot` v1:
   предлокализованные строки (`labels`, `days`, `daysFull` — язык на момент
   пуша), уроки (день/время/аудитория/тип), дедлайны (окно **14 дней**,
   максимум 20, просрочка старше 6 ч не показывается), границы семестра и
   праздники. Пушится `invoke('write_widget_data')` при открытии, синках и
   визибле (мобильная ветка NotificationAgent). Ошибки молча — виджеты не
   критичны.
2. **Rust** (`write_widget_data` в `lib.rs`): только Android — пишет файл в
   `app_data_dir/widget_snapshot.json` **и** `app_data_dir/files/...` (маппинг
   app_data_dir на Android неочевиден — дублируем в оба места). Десктоп — no-op.
3. **Kotlin** (`src-tauri/custom-android/.../widgets/WidgetData.kt`): читает
   все четыре кандидата пути (dataDir/filesDir ± identifier-поддиректория) и
   **при каждом рендере сам вычисляет** «ближайшие пары / неделю / дедлайны»
   от текущего момента — контент не застывает между обновлениями приложения.
   Каждая строка уже локализована в снапшоте — Kotlin ничего не переводит.
4. **Тап** по виджету → PendingIntent launch приложения.
5. **Палитра** (`WidgetRenderer.palette`): тёмная/светлая по ночному режиму
   системы на момент рендера (`UI_MODE_NIGHT_MASK`) — фон
   `widget_bg`/`widget_bg_light`, цвета строк рантайм `setTextColor`
   (XML-цвета — фоллбек). Акценты: у «Мерзімдер» дедлайны ближе 24 ч —
   оранжевое время; у «Кесте» сегодняшний день — яркий акцент заголовка
   дня + суффикс « · Бүгін».

Рендер v2: корень `wrap_content` (фон по контенту, без пустоты), шапка —
иконка приложения (`ic_launcher`) + акцентный заголовок, двухколонные строки
`widget_row_event` (время/дата акцентом sky-300/sky-700 + название), дедлайны
— ≤4 строк.

### Обновления

- `updatePeriodMillis = 30 мин` (системное, провайдеры);
- `MainActivity.onResume` → `updateAll` всех трёх провайдеров (снапшот мог
  измениться, время на часах — тем более);
- пуш снапшота фронтендом при синках/открытии.

### Оверлей `custom-android/`

CI после `tauri android init` копирует `cp -r src-tauri/custom-android/. gen/android/`
поверх сгенерированного проекта: `AndroidManifest.xml` (+3 receiver'а виджетов,
+`REQUEST_INSTALL_PACKAGES`, +свой FileProvider), `MainActivity.kt` (extends
TauriActivity), `UpdaterPlugin.kt`, `widgets/*.kt` (WidgetData, WidgetRenderer,
3 провайдера), `res/{layout,drawable,xml,raw}`. Иконки приложения ставятся
отдельно: `cp -r src-tauri/icons/android/* gen/android/app/src/main/res/`
(без этого — дефолтный робот на домашнем экране). Community-плагин
`tauri_plugin_widgets` — план Б (0.x, 1 мейнтейнер), не используется.

Разрешения оверлей-манифеста: `INTERNET`, `POST_NOTIFICATIONS`,
`SCHEDULE_EXACT_ALARM`, `VIBRATE`, `REQUEST_INSTALL_PACKAGES`.

---

## 6. PDF-просмотрщик

Android WebView не рендерит PDF и `window.open(blob:)` там не работает →
новый роут **`/pdf/:id`** (`src/pages/PdfViewerPage.tsx`): pdfjs-dist, воркер
как vite-ассет (`?url` — работает и под tauri-протоколом, и на вебе),
постраничная навигация, чтение блоба из IndexedDB-стора `pdfFiles`
(`src/lib/pdf-store.ts`). В Tauri `UploadedPdfs` навигирует на этот роут;
на вебе в браузере с PDF-движком — прежний `window.open(blob:)`. Роут
полезен и в PWA (Firefox без встроенного рендера и т.п.).

Блобы PDF **не попадают в бекап** — только локально на устройстве
(оффлайн-УМКД, задаются в curriculum-builder через `subject.pdfs`).

---

## 7. Данные и совместимость с PWA

| Что | Где | Совместимость |
|---|---|---|
| Основные данные | IndexedDB `aristos_db` (v4: subjects, schedules, calendars, settings, canvasCourses, canvasAssignments, platonusYears, pdfFiles) | идентична PWA — один и тот же код `src/lib/db.ts` |
| Бекапы/JSON-конфиги | `src/lib/backup.ts` | файлы из PWA восстанавливаются в Tauri и наоборот |
| Настройки/флаги | `localStorage` (у Tauri-WebView свой профиль, не браузерный) | не переносится автоматически — перенос через бекап |
| Облачный синк | `src/lib/cloud.ts`, воркер `https://aristos-sync.aristoss.workers.dev` (вшит как `DEFAULT_CLOUD_ENDPOINT`) | код+passphrase, клиентское шифрование; **`ALLOWED_ORIGIN` воркера должен включать `http://tauri.localhost,tauri://localhost`** (уже сделано в `sync-worker/wrangler.toml`) — иначе cloud pull из Tauri отклонится CORS'ом; **на Android это единственный источник синка** |
| УМКД-PDF | стор `pdfFiles` (блобы) | локально на устройстве, в бекап не входят |

---

## 8. Конфигурация Tauri

### `src-tauri/tauri.conf.json`

- `version`: **0.1.4**; `identifier`: `kz.yessenov.aristos`; `productName`: Aristos.
- `withGlobalTauri: true` — остался (задел IPC; title-канал Платонуса его
  не требует).
- Окно `main`: 1200×820, min 420×640, `center: true`.
- `security.csp: null` (страница грузится под tauri-протоколом; инжекты в
  harvest идут мимо CSP основного окна).
- `plugins.updater`: endpoint `…/api/app/file/latest.json` + minisign pubkey.
  **Секции `plugins.notification` быть не должно** (§4.3 — крэш старта).
- `bundle`: targets all, `createUpdaterArtifacts: true` (exe/tar.gz + `.sig`),
  category Education, иконки png/icns/ico.
- `build`: `beforeBuildCommand: npm run build`, `frontendDist: ../dist`,
  dev — `http://localhost:5173`.

### `src-tauri/Cargo.toml`

Зависимости: `tauri` 2; плагины `notification`, `updater`, `process`,
`opener`; `reqwest` 0.12 (rustls-tls, gzip, json — без default-features),
`tokio` (time), `percent-encoding`, serde/serde_json.
Release-профиль: `opt-level = "s"`, `panic = "abort"`, `strip = true`,
**без LTO** (сборка идёт и на слабой машине юзера; размер — не критерий).
`crate-type = ["staticlib", "cdylib", "rlib"]` (нужно для мобильных таргетов).

### Android-специфика

- **ProGuard minify НЕ включать** — ломает notification-плагин;
  `res/raw/keep.xml` держит `ic_notification` против ресурсного шринкера.
- Сборка universal APK (4 ABI: aarch64/armv7/i686/x86_64) — один файл на все
  устройства.

---

## 9. Разработка и сборка

### Локально (desktop)

```bash
npm install
npm run tauri dev      # vite dev на 5173 + tauri-окно
npm run tauri build    # релиз-сборка + бандлы (deb/AppImage в Linux)
```

Prereq Linux: `webkit2gtk-4.1`, `libgtk-3-dev`, `libayatana-appindicator3-dev`,
`librsvg2-dev` (на юзерской машине webkit2gtk-4.1 уже стоит). Windows —
WebView2 в системе; macOS — WKWebView системный.

### Android (локально)

```bash
npx tauri android init                                     # один раз
cp -r src-tauri/custom-android/. src-tauri/gen/android/    # оверлей (после каждого init)
cp -r src-tauri/icons/android/* src-tauri/gen/android/app/src/main/res/  # иконки
npx tauri android build --apk                              # universal APK
```

Нужны JDK 17, Android SDK (platforms;android-34, build-tools;34.0.0), NDK
(27.2.x), Rust-таргеты `aarch64-linux-android`,
`armv7-linux-androideabi`, `i686-linux-android`, `x86_64-linux-android`.

### CI (`.github/workflows/release.yml`)

Триггеры: **пуш тега `v*`** (публикация GitHub Release) и ручной запуск
(артефакты в Actions). `permissions: contents: write`.

- **Job desktop** (матрица ubuntu-24.04 / windows-latest / macos-latest):
  ключ updater'а из репо (`TAURI_SIGNING_PRIVATE_KEY` через heredoc-stdin —
  BSD-base64 на macOS не принимает файл аргументом) → `tauri-action` с
  `includeUpdaterArtifacts: true` → бандлы: deb/AppImage/rpm, NSIS exe,
  dmg (без подписи — правый клик → «Открыть», или
  `xattr -cr /Applications/Aristos.app`). Публикация в канал обновлений:
  Windows заливает exe+.sig в воркер, macOS — `.app.tar.gz`+.sig+dmg.
  На теге — GitHub Release; без тега — `upload-artifact`
  (`desktop-<platform>`, 90 дней).
- **Job android**: JDK17 (temurin), SDK/NDK (sdkmanager ищется прямым путём —
  не на PATH на ubuntu-24.04), `tauri android init` + оверлей + иконки,
  keystore **из репо** (`grep -qI`: текст = b64 → декодировать, бинарник =
  копия; иначе секреты `ANDROID_KEYSTORE_B64`/`ANDROID_KEYSTORE_PASSWORD`;
  иначе эфемерный с артефактом), сборка → **ручная подпись** `zipalign` +
  `apksigner` (независимо от CLI, пароль `aristos-sign-2026`) →
  `Aristos_<v>.apk` → заливка в канал обновлений + артефакт + Release.
- **Job publish-updates** (`needs: [android, desktop]`): собирает
  `latest.json` (Python: платформы по наличию `.sig` на воркере) и `meta` →
  PUT в воркер. Если заливка не удалась — проверить, что воркер задеплоен
  с `APP_UPLOAD_SECRET`.

Релиз: `git tag v0.1.4 && git push origin v0.1.4` → в Release появятся
exe/dmg/deb/AppImage/APK + канал обновлений получит новую версию.

---

## 10. Карта файлов Tauri-части

```
src-tauri/
  tauri.conf.json          # v0.1.4; plugins.updater; БЕЗ plugins.notification
  Cargo.toml               # + updater/process/opener, reqwest, tokio, percent-encoding
  src/lib.rs               # плагины + все команды; write_widget_data (двойная запись)
  src/sync.rs              # harvest-окно: sync_open/eval/url/diag/close/payload
  src/canvas.rs            # Canvas-синк в Rust: session_state + sync_native (reqwest)
  src/install.rs           # download_update + install_apk; не-фатальная регистрация
  capabilities/default.json     # main: core+notif+updater+process+opener+свои команды
  capabilities/remote-sync.json # harvest remote-IPC (задел v1)
  permissions/aristos.toml      # ACL собственных команд (allow-*)
  custom-android/          # оверлей: манифест (+REQUEST_INSTALL_PACKAGES, +свой
                           #   FileProvider), MainActivity, UpdaterPlugin.kt,
                           #   widgets/*.kt, keep.xml, aristos_file_paths.xml
  keystore/                # aristos-sign.b64 (APK), aristos-updater.b64 (minisign)
  icons/                   # desktop + ios + android иконки (android/* копируются в CI)
  gen/                     # сгенерированные схемы/проект (в git частично)
src/lib/
  tauri.ts                 # isTauri / isTauriMobile
  native-sync.ts           # оркестратор: Canvas-натив + Платонус title-канал
  injected/platonus-page.js     # инжект-драйвер Платонуса (canvas-collector.js удалён)
  reminders.ts             # напоминания + дайджест + группы + largeBody
  notifications.ts         # транспорт + NOTIF_ICON/iconColor + настройки
  app-update.ts            # проверка/установка обновлений (mobile + desktop)
  widget-snapshot.ts       # сборка JSON-снапшота для виджетов
  pdf-store.ts             # стор pdfFiles (блобы в IndexedDB)
src/pages/PdfViewerPage.tsx      # /pdf/:id (pdfjs)
src/components/layout/NativeSyncSection.tsx  # UI нативного синка (desktop-only)
src/components/layout/UpdateSection.tsx      # версия + баннер обновления
src/components/layout/NotificationAgent.tsx  # тик уведомлений; mobile-ветка
.github/workflows/release.yml   # desktop + android + publish-updates
CHANGELOG.md                    # журнал изменений веб-версии, проигранный при порте
```

---

## 11. Troubleshooting

| Симптом | Причина / действие |
|---|---|
| Приложение падает при старте (`invalid type: map, expected unit`) | Секция `plugins.notification` в `tauri.conf.json` — убрать (крэш 0.1.1–0.1.3) |
| Canvas-синк сразу открывает окно логина | Сессия умерла — штатно: превентивная проверка кук; логин один раз, куки персистентны |
| «балдар жүктелмеді» после успешного Canvas-синка | `scoresDiag`: ретраи enrollments исчерпаны (вуз вынес итоги в LTI-тул) — повторить синк, причина в скобках |
| `sync-already-running` | Предыдущий синк ещё не завершился — дождись таймаута/завершения |
| `login-timeout` | 6 минут не ушли со страницы входа — повтори кнопку синка |
| `platonus-no-periods` | Страница журнала не отдала селекты годов — проверь, что аккаунт видит `/student_register`; studentID ищется в `window.student` |
| Платонус-период висит до 20 мин и падает `sync-timeout` | Съём оценок по дням кликами долгий — норма для больших периодов; падение = скрипт не дошёл до конца: `sync_diag` → title `ARISTOS_E\|…`; `diag-no-window` = harvest закрылся |
| Уведомления на десктопе не приходят «по расписанию» | Так и задумано: на десктопе напоминания только in-app (плагин доставил бы их мгновенно) |
| Уведомления без иконки / серый квадрат | `ic_notification` вырезан ресурсным шринкером (проверь `keep.xml`) — плагин подставляет системный `ic_dialog_info` |
| Обновление не находится (desktop) | `latest.json` на воркере пуст/не залит (job `publish-updates`) или pubkey в конфиге не совпадает с ключом подписи |
| Обновление не находится (Android) | `/api/app/meta` не залита; версия релиза не bump'нута (баннер сравнивает строго) |
| Android: «need-permission» при установке | Право «неизвестные источники» — выдать в открывшихся настройках и повторить |
| Облачный pull из Tauri падает | `ALLOWED_ORIGIN` воркера должен содержать `http://tauri.localhost,tauri://localhost` (`sync-worker/wrangler.toml`) |
| Новый APK не ставится поверх старого | Другая подписи — старый keystore потерян; источник истины теперь в репо (`src-tauri/keystore/aristos-sign.b64`) |
| Linux не обновляется сам | Так и задумано: AppImage > 25 МБ лимита KV — deb обновлять вручную |
| Виджеты показывают старое | Они пересчитываются при рендере — открой приложение (onResume обновит) или жди системный тик 30 мин |
| PDF не открывается на Android | Должен открываться через роут `/pdf/:id` (pdfjs). Если путь идёт через `window.open` — гейт `isTauri()` не сработал |
| macOS: «приложение повреждено» | Без подписи — `xattr -cr /Applications/Aristos.app` |

---

## 12. Что ещё почитать

- `CONTEXT.md` — сжатый контекст всего проекта (сторы, синк-протокол, формулы оценок, история решений миграции).
- `CHANGELOG.md` — журнал изменений веб-версии (записи с пометками «Для Tauri»).
- `docs/canvas-lms.md` — API Canvas: эндпоинты, CSRF, пагинация, поля payload.
- `docs/platonus.md` — архитектура Платонуса: SSO, student_register, карточки журнала, marksModal.
- `docs/user-css.md` — пользовательский CSS (modder API).
- Лендинг: `aristoslanding.vercel.app/docs/tauri` (пользовательский обзор), `/docs/sync`, `/docs/configs`, `/docs/ai`, `/docs/data`, `/docs/faq`.
