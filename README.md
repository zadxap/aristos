# Aristos — Tauri-порт (Desktop + Android)

Нативная версия студенческого дашборда **Aristos**: Tauri 2 поверх того же Vite-билда,
что и у [PWA](https://github.com/zxrcode/aristos_v2). PWA остаётся веб-дистрибуцией
(Vercel + расширение), этот репозиторий добавляет:

- **Windows / macOS / Linux** — установщики через канал обновлений (`tauri build`);
- **Android APK** — виджеты на домашнем экране и нативные напоминания (sideload);
- **встроенный Canvas/Платонус-синк** — окно логина внутри приложения, браузерное
  расширение не нужно;
- **автообновления** — приложение само предложит новую версию.

Идентификатор приложения: `kz.yessenov.aristos` · версия — в `src-tauri/tauri.conf.json`
(единственный источник правды, футер читает её оттуда).

> iOS нативно не собираем — там работает PWA («На экран “Домой”»).

---

## Отличия от PWA

| Область | PWA (веб) | Tauri |
|---|---|---|
| Роутер | `BrowserRouter` | `HashRouter` (гейт `isTauri()` в `src/App.tsx`) |
| Синк Canvas | расширение MV3 | нативно: `src-tauri/src/canvas.rs` — reqwest с куками webview (`cookies_for_url` + CSRF), Link-пагинация, нормализация в Rust |
| Синк Платонус | скрытая вкладка расширения | инжект-драйвер `src/lib/injected/platonus-page.js`, доставка чанками через `document.title` (`ARISTOS_D\|idx\|total\|chunk`), поллинг `sync_diag` 350 мс |
| Логин синка | живая сессия браузера | окно `harvest` (`src-tauri/src/sync.rs`): Canvas — сразу `/login/openid_connect` (SSO портала `id.yu.edu.kz`); сессия персистентна в профиле webview |
| Уведомления | SW-нотификации, пока вкладка открыта | `@tauri-apps/plugin-notification`; на мобильном `src/lib/reminders.ts` планирует на 7 дней вперёд (пары / дедлайны −24 ч), рефреш через headless `NotificationAgent` |
| Виджеты | — | 3 шт. на Android: NextPairs (4×2), WeekSchedule (4×3), Deadlines (4×2) |
| PDF | `window.open(blob)` | роут `/pdf/:id` на pdfjs-dist (Android WebView не рендерит PDF) — работает и в PWA |
| Сервис-воркер | да (автоапдейт) | **выключен**: `injectRegister: null` + в `main.tsx` unregister всех SW (иначе протокол `tauri.localhost` отдаёт старый sw.js и приложение «застывает» на старом бандле) |
| Облачный синк | да | да (`ALLOWED_ORIGIN` воркера включает `tauri://localhost`, `http://tauri.localhost`) |

Синк-пейлоады и семантика применения — **те же**, что в веб-версии
(`aristos-canvas-sync` / `aristos-platonus-sync`, полная замена сторов).

### Виджеты Android (без JNI-плагина)

Rust-команда `write_widget_data` пишет JSON-снапшот
(`src/lib/widget-snapshot.ts`: пары/дедлайны/семестр/праздники, строки
предлокализованы) в `app_data_dir/widget_snapshot.json`. Kotlin-провайдеры
при каждом рендере сами вычисляют контент (`WidgetData.kt`) — данные не
«застывают». Обновление: `updatePeriodMillis` 30 мин + `onResume` в MainActivity +
пуш снапшота при синках. Тап открывает приложение.

---

## Сборка

```bash
npm install

# десктоп (dev)
npm run tauri dev

# десктоп (релиз)
npm run tauri build

# Android
npm run tauri android init        # один раз
cp -r src-tauri/custom-android/. gen/android/   # оверлей: манифест, виджеты, MainActivity
npm run tauri android build --apk
```

- Rust-профиль: release `opt-level=s`, **без** LTO; ProGuard minify **не включать**
  (ломает notification-плагин).
- Разрешения Android (оверлей-манифест): INTERNET, POST_NOTIFICATIONS,
  SCHEDULE_EXACT_ALARM, VIBRATE.
- Каналы уведомлений Android: `aristos-lessons` / `aristos-deadlines`.

### CI / релизы

`.github/workflows/release.yml` — триггеры: пуш тега `v*` или ручной запуск.

- **desktop** — tauri-action на ubuntu/windows/macos → NSIS exe (+`.sig`), dmg, AppImage/deb;
- **android** — JDK 17 + SDK/NDK → `tauri android init` + оверлей `custom-android/` +
  universal APK (подпись из секретов `ANDROID_KEYSTORE_B64`/`ANDROID_KEYSTORE_PASSWORD`;
  при эфемерном keystore артефакт `keystore.jks` нужно сохранить — подпись должна быть
  стабильной, чтобы обновления ставились поверх);
- **publish-updates** — собирает `latest.json` (подписи minisign: приватный ключ в
  `src-tauri/keystore/`, публичный в `tauri.conf.json`) и заливает релизы в воркер
  (`PUT /api/app/file/:name`, секрет из `wrangler.toml`).

Канал обновлений: `https://aristos-sync.aristoss.workers.dev/api/app/file/latest.json`
(тот же воркер, что и облачный синк). Desktop обновляется через `tauri-plugin-updater`
(downloadAndInstall + relaunch); Android — сравнение версий + скачивание APK через
plugin-opener. AppImage (≈100 МБ) в KV не влезает — Linux обновляется вручную (deb).

---

## Структура

```
├── src/                    # тот же фронт, что в PWA (+ tauri-гейты)
│   ├── lib/
│   │   ├── tauri.ts           # isTauri / isTauriMobile
│   │   ├── native-sync.ts     # очередь сообщений, логин-флоу, waitPlatonusMessage
│   │   ├── reminders.ts       # планирование уведомлений (мобильная ветка)
│   │   └── widget-snapshot.ts # снапшот для виджетов
│   └── pages/PdfViewerPage.tsx
├── src-tauri/
│   ├── src/
│   │   ├── canvas.rs       # нативный Canvas-синк (сессия + reqwest)
│   │   ├── sync.rs         # окно harvest: sync_open/eval/url/close (sync_open — async!)
│   │   └── lib.rs          # плагины + write_widget_data
│   ├── custom-android/     # оверлей: AndroidManifest, MainActivity.kt, widgets/*.kt, res/
│   ├── capabilities/       # permissions (notification, write-widget-data, remote-sync)
│   └── tauri.conf.json     # версия, апдейтер, бандл
└── .github/workflows/release.yml
```

UI синка — `NativeSyncSection.tsx` в боковом меню (виден только `isTauri() && !isTauriMobile()`).
Ошибки — машина-ключи: `need-login`, `login-timeout`, `sync-already-running`,
`sync-timeout`, `platonus-no-periods`, `platonus-empty`, `invalid-payload`.

---

## Известные ловушки Windows (уже починены, не регрессировать)

1. **Дедлок создания окна.** `sync_open` обязан быть **async**-командой: синхронная
   команда исполняется на главном потоке внутри COM-диспетчеризации, и колбэк
   `CreateCoreWebView2Environment` никогда не доставляется → «белое окно навсегда»
   (см. wry#583/wry#1665). Симптом в `sync-debug.log`: обрыв на «open url=» без «created ok».
2. **Логин Canvas — только через OAuth-портал.** Прямая форма Canvas мертва для
   университетских учёток; в webview корень `canvas.yu.edu.kz` не редиректит на SSO —
   открывать `https://canvas.yu.edu.kz/login/openid_connect` **напрямую**. Конец входа
   ловится поллером кук (`canvas_session_state`), не URL.
3. **Service Worker переживает обновления приложения.** HTTP-кэш `tauri.localhost` не
   отдаёт свежий sw.js → после апдейта приложение работает на старом бандле. Фикс:
   `injectRegister: null` в `vite.config.ts` + unregister в `main.tsx`. Если у машины-жертвы
   SW уже прописался: закрыть приложение, удалить
   `%LOCALAPPDATA%\kz.yessenov.aristos\EBWebView\Service Worker` и
   `EBWebView\Default\Service Worker` (**IndexedDB не трогать — там данные**).

---

## Синхронизация с веб-репозиторием

Порт проигрывает историю [aristos_v2](https://github.com/zxrcode/aristos_v2)
коммит-за-коммитом (база — коммит `b16f8e7`). Дисциплина изменений и журнал —
`CHANGELOG.md` веб-репозитория; архитектурная шпаргалка — его `CONTEXT.md`.
Каждая запись чейнджлога имеет раздел «Для Tauri» — что перенести и как.
