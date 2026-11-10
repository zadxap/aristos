# Aristos Desktop / Android (Tauri) — техническая документация

> Документ для разработки и сопровождения Tauri-версии Aristos. Дополняет
> `CONTEXT.md` (краткий контекст проекта) и лендинг `aristoslanding.vercel.app/docs/tauri`
> (пользовательское описание). Все факты — из кода репозитория.
> Версия Tauri: 2 (`@tauri-apps/api` 2.12, CLI 2.12). Identifier: `kz.yessenov.aristos`.

---

## 1. Общая картина

Aristos — один фронтенд (Vite + React 19 + TS + Tailwind 4), три дистрибуции:

| Дистрибуция | Оболочка | Синк Canvas/Платонус | Напоминания | Виджеты |
|---|---|---|---|---|
| **PWA** (Vercel, `aristoss.vercel.app`) | браузерная вкладка + Service Worker | MV3-расширение (`extension/`) | in-app агент (NotificationAgent) | — |
| **Desktop** (Tauri: Linux / Windows / macOS) | системный webview (WebKitGTK / WebView2 / WKWebView) | **нативный** (скрытое webview-окно, замена расширения) | in-app агент через нативный плагин | — |
| **Android** (Tauri APK, sideload) | Android WebView | нативный | **запланированные** напоминания (работают при закрытом приложении) | **3 виджета** (RemoteViews) |

iOS нативно не делается — там работает PWA («на экран Домой»).

Ключевой принцип миграции: **фронт тот же билд** (`vite build` → `dist/`,
`tauri.conf.json → frontendDist: ../dist`), Tauri — только обёртка + нативные
фичи. Вся платформо-специфичная логика фронтенда расходится по гейтам
`isTauri()` / `isTauriMobile()`.

### Что изменилось по сравнению с PWA

1. **Синк без расширения.** Вместо MV3-расширения — скрытое webview-окно
   `harvest`, в которое инжектятся те же коллекторы (порты userscript-логики).
   Нет CORS-ограничений расширения и нет троттлинга MV3-воркера.
2. **Роутер.** В Tauri — `HashRouter` (path-роутинг под кастомным протоколом
   ненадёжен), на вебе — прежний `BrowserRouter` (`src/App.tsx:18`).
3. **Уведомления.** Транспорт — `@tauri-apps/plugin-notification` вместо
   Web Notification API; на Android добавляется планирование на неделю вперёд.
4. **Виджеты Android** (только мобильная ветка) — данные через JSON-снапшот
   в файл приложения.
5. **PDF.** Android WebView не рендерит PDF → встроенный просмотрщик
   `/pdf/:id` на pdfjs-dist (на вебе по-прежнему `window.open(blob:)`).
6. **База данных та же** — IndexedDB `aristos_db`, бекапы/JSON-конфиги/
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
| `src/components/layout/SideMenu.tsx` (NativeSyncSection) | `isTauri() && !isTauriMobile()` | секция нативного синка видна только на **desktop**-Tauri |
| `src/components/layout/NotificationAgent.tsx` | `isTauriMobile()` | ветка мобильной Tauri: `refreshNativeReminders` + `pushWidgetSnapshot` |
| `src/lib/reminders.ts` | `isTauriMobile()` | планирование нативных напоминаний (на десктопе плагин доставил бы «запланированное» немедленно — поэтому там only in-app агент) |
| `src/lib/widget-snapshot.ts` | `isTauri()` | push снапшота для виджетов (на десктопе Rust-команда no-op) |
| `src/lib/notifications.ts` | `isTauri()` | транспорт плагина vs Web Notification API |
| `src/pages/...` (UploadedPdfs) | `isTauri()` | навигация на `/pdf/:id` вместо `window.open(blob:)` |

---

## 3. Нативный синк Canvas/Платонус (замена расширения)

### 3.1 Механика

Rust создаёт webview-окно с лейблом `harvest` (видимое — только для логина,
иначе скрытое), которое грузит внешний сайт. JS-оркестратор из фронтенда
(`src/lib/native-sync.ts`) инжектит в окно самодостаточные скрипты через
команду `sync_eval`:

- `src/lib/injected/canvas-collector.js` — порт userscript-коллектора Canvas:
  same-origin `fetch /api/v1/` под живой сессией (cookies + CSRF из куки
  `_csrf_token` или `window.ENV.csrfToken`; PAT запрещены админами), пагинация
  через `Link`-заголовок, нормализация. 401 → сообщение `need-login`.
- `src/lib/injected/platonus-page.js` — порт platonus-inpage из расширения:
  драйвер с режимами `discover` (studentID из `window.student`, доступные
  годы/семестры из селектов) и `harvest` (парсер карточек журнала v3:
  полное имя — в `title`-атрибуте, донут — `data-percent`, пары
  «значение / подпись» — из футера, `data-id` = subjectID; оценки по дням —
  кликом по каждой карточке и съёмом `#marksModal`).

Параметры драйвера подставляются **перед** телом скрипта:
`window.__ARISTOS_PARAMS__ = {...}`.

Скрипты на внешних страницах отдают результат IPC-командой
`window.__TAURI__.core.invoke('sync_payload', { json })` (доступна благодаря
`withGlobalTauri: true` в `tauri.conf.json`). Rust рассылает событие
`sync-payload` в main-окно, где `native-sync.ts` раздаёт его waiters'ам.
В отличие от MV3-расширения, ожидания живут на самой странице — `setTimeout`
в webview приложения **не троттлится** до минуты, как service worker.

### 3.2 Rust-команды (`src-tauri/src/sync.rs`, `lib.rs`)

| Команда | Назначение |
|---|---|
| `sync_open(url, visible)` | открыть/переоткрыть `harvest`. При смене URL: закрыть и ждать фактического исчезновения лейбла (40 × 50 мс), чтобы не поймать гонку «label already exists». Окно 940×720, заголовок «Aristos Sync» |
| `sync_eval(js)` | исполнить JS в harvest-окне (инжект-скрипты) |
| `sync_url()` | текущий URL harvest — детект конца логина |
| `sync_diag()` | `{url, title}` harvest для быстрой диагностики отказа: если IPC не дошёл, скрипты пишут в `document.title` breadcrumb `ARISTOS_INJ` (инжект состоялся) или `ARISTOS_E\|причина` |
| `sync_close()` | закрыть harvest |
| `sync_payload(json)` | **вызывается извне** — из инжект-скриптов на внешних страницах; эмитит `sync-payload` в main |
| `write_widget_data(data)` | JSON-снапшот для Android-виджетов (см. §5); вне Android — no-op |

### 3.3 Права IPC (capabilities / permissions)

- `capabilities/default.json` — окно `main`: `core:default`,
  `notification:default`, `allow-write-widget-data`, `allow-sync-open/eval/url/diag/close`.
- `capabilities/remote-sync.json` — окно `harvest`, **remote-URLs**
  `https://canvas.yu.edu.kz/*`, `https://platonus.yu.edu.kz/*`,
  `https://id.yu.edu.kz/*` (SSO-домен): только `allow-sync-payload`. Внешние
  страницы не получают прочих прав.
- `permissions/aristos.toml` — ACL собственных команд приложения: каждый
  `allow-*` = `commands.allow = [...]` для соответствующей Rust-команды.
  Из capabilities ссылки идут на идентификаторы напрямую.

### 3.4 Протокол сообщений (harvest → native-sync.ts)

Канал: событие `sync-payload` со строкой JSON. Типы сообщений:

| `type` | Кто шлёт | Смысл |
|---|---|---|
| `canvas` | canvas-collector | успех: `msg.json` = CanvasSyncPayload |
| `platonus-discovered` | platonus-page (mode `discover`) | `studentID`, `periods[]`, `previewCount` |
| `platonus-period` | platonus-page (mode `harvest`) | `record` = PlatonusYearRecord периода |
| `need-login` | оба | сессии нет — фронт открывает окно логина |
| `error` | оба | `msg.message` — причина |
| `progress` | platonus-page | `{stage:'platonus-marks', year, term, idx, total}` — мимолётный, не копится в очереди |

Доставка через очередь + `waitMessage(match, timeout)`: если сообщение
пришло раньше, чем вызван waiter, — достаётся из очереди (не теряется).

### 3.5 Потоки синка

**Canvas** (`runCanvasSync`):
1. `sync_open(canvas.yu.edu.kz, hidden)` → `sync_eval(canvas-collector)` →
   ждём `canvas|need-login|error` (таймаут **120 с**).
2. `need-login` → окно логина `/login/canvas` (видимое) → поллинг `sync_url`
   каждые 1.5 с до ухода со страницы `/login` (**два стабильных опроса подряд**
   — SSO мигает промежуточными адресами), лимит **6 мин** → ретрай сбора.
3. Валидация **существующим** `isCanvasSyncPayload` → `useDB().syncCanvas`
   (тот же путь, что у расширения: React-стейт + авто-маппинг + авто-push в
   облако) → `sync_close`.

**Платонус** — двухшаговый:
1. **Discover** (`discoverPlatonus`): `/student_register` (hidden) → драйвер
   `mode:'discover'` (таймаут **90 с**) → `studentID` сохраняется в settings
   (`platonusStudentID`), периоды показываются в UI чекбоксами
   (предвыбраны все).
2. **Import** (`runPlatonusSync(chosen)`): для каждого периода —
   `/student_register?studentID={id}&year={Y}&term={T}` → драйвер
   `mode:'harvest'` (таймаут **15 мин** — съём оценок по дням кликами долгий)
   → `record`. Если `studentID` не сохранён — тихий discover внутри.
   `need-login` → видимое окно SSO (вход завершён, когда вернулись на
   `platonus.yu.edu.kz` вне `id.yu.edu.kz`/`login`/`oauth`) → период
   переигрывается (`i--`). В конце собирается payload
   `aristos-platonus-sync` (source не важен — валидатор тот же) →
   `useDB().syncPlatonus` → `sync_close`.

Гейт реентерабельности: `busy` в `native-sync.ts` — вторая попытка во время
синка бросает `sync-already-running`. Очередь сообщений чистится при старте.

### 3.6 UI (`NativeSyncSection.tsx` в SideMenu, desktop-Tauri only)

Кнопки: «Canvas синк» → этапы/ошибки текстом; «Найти доступные периоды»
(discover) → чекбоксы `ГГГГ/семестр` → «Импорт выбранных». Прогресс Платонуса:
«период i/N» и «оценки по дням idx/total». Этапы и ошибки — машины-ключи
(`SyncStage`, коды ошибок) → i18n-ключи `sync*` в `src/i18n/{kk,ru}.ts`.

Ошибки-машины: `need-login` / `login-timeout` / `sync-already-running` /
`sync-timeout` / `platonus-no-periods` / `platonus-empty` /
`canvas-invalid-payload` / `platonus-invalid-payload` (+ сырые сообщения
`error`-сообщений скриптов).

**Семантика данных сохранена**: `applyCanvasSync`/`applyPlatonusSync` по-прежнему
заменяют сторы целиком (полный снапшот, не дельта). В типе payload `source`
добавлен вариант `'app'`.

### 3.7 Известные нюансы

- Сессия webview живёт в данных приложения — при сбое кнопка синка сама
  предложит окно логина (need-login обрабатывается автоматически).
- Диагностика отказа: `sync_diag` → если в `title` harvest-окна `ARISTOS_E|...`,
  там причина (IPC недоступен / ошибка скрипта). `ARISTOS_INJ` = инжект
  состоялся, но ответ не долетел.
- Троттлинга нет, но длительность периода Платонуса ограничена таймаутом
  15 мин — при расширении периодов стоит помнить про суммарное время.

---

## 4. Уведомления

### 4.1 Транспорт

`src/lib/notifications.ts`: в Tauri — `@tauri-apps/plugin-notification`
(`isPermissionGranted`/`requestPermission`/`sendNotification`); на вебе/PWA —
Web Notification API (через Service Worker, если доступен). Права в Tauri
асинхронные — синхронно возвращается `default`, UI (SideMenu) уточняет
эффектом. Настройки — `localStorage` (`aristos-notif-settings-v1`):
`lessons`, `deadlines`, `minutesBefore` (по умолчанию 5; выбор
5/10/15/30 в SideMenu). Журнал показанного — `aristos-notif-shown-v1`
(`notifyOncePerDay` — в-app тик, чтобы не спамить каждый тик).

### 4.2 Desktop-Tauri

Планирование не используется: плагин на десктопе доставил бы «запланированное»
немедленно. Работает in-app агент `NotificationAgent` (прежняя v0-логика:
пары за `minutesBefore`, дедлайны за 24 ч, `notifyOncePerDay`), но отправка
идёт через нативный плагин.

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
- **Дедлайны Canvas**: не сданные (`!submitted_at`), за 24 ч до `due_at`
  (если уже ближе — через минуту).

Каналы Android: `aristos-lessons` и `aristos-deadlines`
(importance HIGH, вибрация, огни). Разрешения манифеста: `POST_NOTIFICATIONS`,
`SCHEDULE_EXACT_ALARM`, `VIBRATE`.

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

### Обновления

- `updatePeriodMillis = 30 мин` (системное, провайдеры);
- `MainActivity.onResume` → `updateAll` всех трёх провайдеров (снапшот мог
  измениться, время на часах — тем более);
- пуш снапшота фронтендом при синках/открытии.

### Оверлей `custom-android/`

CI после `tauri android init` копирует `cp -r src-tauri/custom-android/. gen/android/`
поверх сгенерированного проекта: `AndroidManifest.xml` (+3 receiver'а виджетов,
+разрешения), `MainActivity.kt` (extends TauriActivity), `widgets/*.kt`
(WidgetData, WidgetRenderer, 3 провайдера), `res/{layout,drawable,xml}/widget_*`.
Community-плагин `tauri_plugin_widgets` — план Б (0.x, 1 мейнтейнер), не используется.

Разрешения оверлей-манифеста: `INTERNET`, `POST_NOTIFICATIONS`,
`SCHEDULE_EXACT_ALARM`, `VIBRATE`.

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
| Облачный синк | `src/lib/cloud.ts`, воркер `https://aristos-sync.aristoss.workers.dev` (вшит как `DEFAULT_CLOUD_ENDPOINT`) | код+passphrase, клиентское шифрование; **`ALLOWED_ORIGIN` воркера должен включать `http://tauri.localhost,tauri://localhost`** (уже сделано в `sync-worker/wrangler.toml`) — иначе cloud pull из Taurи отклонится CORS'ом |
| УМКД-PDF | стор `pdfFiles` (блобы) | локально на устройстве, в бекап не входят |

---

## 8. Конфигурация Tauri

### `src-tauri/tauri.conf.json`

- `identifier`: `kz.yessenov.aristos`; `productName`: Aristos; версия 0.1.0.
- `withGlobalTauri: true` — **обязателен**: инжект-скрипты синка на внешних
  страницах зовут `window.__TAURI__.core.invoke('sync_payload')`.
- Окно `main`: 1200×820, min 420×640, `center: true`.
- `security.csp: null` (страница грузится под tauri-протоколом; инжекты в
  harvest идут мимо CSP основного окна).
- `bundle`: targets all, category Education, описания на казахском, иконки
  png/icns/ico.
- `build`: `beforeBuildCommand: npm run build`, `frontendDist: ../dist`,
  dev — `http://localhost:5173`.

### `src-tauri/Cargo.toml`

Зависимости: `tauri` 2, `tauri-plugin-notification` 2, serde/serde_json.
Release-профиль: `opt-level = "s"`, `panic = "abort"`, `strip = true`,
**без LTO** (сборка идёт и на слабой машине юзера; размер — не критерий).
`crate-type = ["staticlib", "cdylib", "rlib"]` (нужно для мобильных таргетов).

### Android-специфика

- **ProGuard minify НЕ включать** — ломает notification-плагин.
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
npx tauri android build --apk                              # universal APK
```

Нужны JDK 17, Android SDK (platforms;android-34, build-tools;34.0.0), NDK
(27.2.12479018), Rust-таргеты `aarch64-linux-android`,
`armv7-linux-androideabi`, `i686-linux-android`, `x86_64-linux-android`.

### CI (`.github/workflows/release.yml`)

Триггеры: **пуш тега `v*`** (публикация GitHub Release) и ручной запуск
(артефакты в Actions).

- **Job desktop** (матрица): `ubuntu-24.04` (deb/AppImage/rpm),
  `windows-latest` (NSIS exe), `macos-latest` (dmg, без подписи — правый клик
  → «Открыть», или `xattr -cr /Applications/Aristos.app`). Сборка через
  `tauri-apps/tauri-action@v0`; на теге — Release с приложенными бандлами,
  без тега — `upload-artifact` (`desktop-<platform>`, 90 дней).
- **Job android**: JDK17 (temurin), SDK/NDK (sdkmanager ищется прямым путём —
  не на PATH на ubuntu-24.04), `tauri android init` + оверлей, подпись:
  секреты `ANDROID_KEYSTORE_B64` (base64 keystore.jks) +
  `ANDROID_KEYSTORE_PASSWORD`, иначе **эфемерный keystore** — артефакт
  `keystore.jks` нужно скачать и сохранить, иначе следующие APK не встанут
  поверх старых. Пароль по умолчанию `aristos-sign-2026`. APK публикуется в
  Release на теге + артефакт `android-apk`.

Релиз: `git tag v0.1.0 && git push origin v0.1.0` → в Release появятся
exe/dmg/deb/AppImage/APK.

---

## 10. Карта файлов Tauri-части

```
src-tauri/
  tauri.conf.json          # конфиг приложения (identifier, окно, withGlobalTauri, bundle)
  Cargo.toml               # tauri 2 + notification; release: opt-level=s, без lto
  src/lib.rs               # write_widget_data + регистрация команд sync::*
  src/sync.rs              # harvest-окно: sync_open/eval/url/diag/close/payload
  capabilities/default.json    # main: core + notification + sync-* + widget
  capabilities/remote-sync.json # harvest на canvas/platonus/id: только sync_payload
  permissions/aristos.toml     # ACL собственных команд (allow-*)
  custom-android/          # оверлей поверх gen/android (виджеты, манифест, MainActivity)
  icons/                   # desktop + ios + android иконки
  gen/                     # сгенерированные схемы/проект (в git частично)
src/lib/
  tauri.ts                 # isTauri / isTauriMobile
  native-sync.ts           # оркестратор нативного синка (очередь, waiters, логин)
  injected/canvas-collector.js  # инжект: Canvas API сборщик (порт userscript)
  injected/platonus-page.js     # инжект: драйвер Платонуса (discover/harvest)
  reminders.ts             # планирование напоминаний на 7 дней (Android)
  notifications.ts         # транспорт уведомлений + настройки + notifyOncePerDay
  widget-snapshot.ts       # сборка JSON-снапшота для виджетов
  pdf-store.ts             # стор pdfFiles (блобы в IndexedDB)
src/pages/PdfViewerPage.tsx      # /pdf/:id (pdfjs)
src/components/layout/NativeSyncSection.tsx  # UI нативного синка (SideMenu)
src/components/layout/NotificationAgent.tsx  # тик уведомлений; mobile-ветка
.github/workflows/release.yml   # desktop матрица + android APK
```

---

## 11. Troubleshooting

| Симптом | Причина / действие |
|---|---|
| Синк просит логин каждый раз | Сессия webview не пережила что-то — это штатно: need-login обрабатывается автоматически, окно логина откроется само. Если SSO завис — проверь `sync_diag` (title `ARISTOS_E\|...`) |
| `sync-already-running` | Предыдущий синк ещё не завершился — дождись таймаута/завершения |
| `login-timeout` | 6 минут не ушли со страницы входа — повтори кнопку синка |
| `platonus-no-periods` | Страница журнала не отдала селекты годов — проверь, что аккаунт видит `/student_register`; studentID ищется в `window.student` |
| Платонус-период висит до 15 мин и падает таймаутом | Съём оценок по дням кликами долгий — норма для больших периодов; падение = скрипт не дошёл до конца (см. `sync_diag`) |
| Уведомления на десктопе не приходят «по расписанию» | Так и задумано: на десктопе напоминания только in-app (плагин доставил бы их мгновенно) |
| Облачный pull из Tauri падает | `ALLOWED_ORIGIN` воркера должен содержать `http://tauri.localhost,tauri://localhost` (`sync-worker/wrangler.toml`) |
| Новый APK не ставится поверх старого | Другой подписи — ставь с удалением старого; впредь храни `keystore.jks` (секрет `ANDROID_KEYSTORE_B64`) |
| Виджеты показывают старое | Они пересчитываются при рендере — открой приложение (onResume обновит) или жди системный тик 30 мин; если пусто — снапшот не писался (синк/открытие не было) |
| PDF не открывается на Android | Должен открываться через роут `/pdf/:id` (pdfjs). Если путь идёт через `window.open` — гейт `isTauri()` не сработал |
| macOS: «приложение повреждено» | Без подписи — `xattr -cr /Applications/Aristos.app` |

---

## 12. Что ещё почитать

- `CONTEXT.md` — сжатый контекст всего проекта (формулы оценок, сторы, история решений).
- `docs/canvas-lms.md` — API Canvas: эндпоинты, CSRF, пагинация, поля payload.
- `docs/platonus.md` — архитектура Платонуса: SSO, student_register, карточки журнала, marksModal.
- `docs/user-css.md` — пользовательский CSS (modder API).
- Лендинг: `aristoslanding.vercel.app/docs/tauri` (пользовательский обзор), `/docs/sync`, `/docs/configs`, `/docs/ai`, `/docs/data`, `/docs/faq`.
