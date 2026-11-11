# Aristos — контекст проекта (сжатый, для нового чата)

## Что это
Студенческий дашборд «Aristos» (Yessenov University) — оффлайн PWA на Vite + React 19 + TS + Tailwind 4 + shadcn/ui.
Заменяет необходимость заходить в Canvas и Платонус вручную.

## Архитектура
- **Данные**: IndexedDB (`aristos_db`, DB_VERSION=3). Сторы: subjects, schedules, calendars, settings, canvasCourses, canvasAssignments, platonusYears.
- **Синк Canvas**: MV3-расширение (`extension/`) — service worker фетчит `/api/v1/` под живой сессией (cookies + CSRF из куки `_csrf_token`, PAT запрещены админами). Пагинация через Link header. Двойная доставка: localStorage(`aristosCanvasSync`) + postMessage ack.
- **Синк Платонус**: journal сервер-рендерный — `GET /student_register?studentID={id}&year={Y}&term={T}` возвращает готовый HTML (studentID=208 из `window.student`). Парсится DOMParser'ом ВНУТРИ вкладки Aristos (executeScript MAIN world), т.к. SW не имеет DOMParser.
- **Синк-протокол**: payload `{format:'aristos-canvas-sync'|'aristos-platonus-sync', version:1, syncedAt, source, ...}` → applyCanvasSync/applyPlatonusSync заменяют сторы целиком.
- **Сервер**: `npx vite preview --port 5174 --strictPort` — стабильная сборка (НЕ dev, там были зомби-процессы и ECONNRESET).

## Формула оценок
РК1 = Ср.тек.1 (до рубежки), РК2 = Ср.тек.2, Рейтинг = (РК1+РК2)/2, **Итог = round(0.6×Рейтинг + 0.4×Экз)**.
Неделя работы определяется из названия: «Тәжірибелік жұмыс №2» = 2-апта (парсинг №N, хвост N, начало N). Недели 1–8 = РК1, 9–15 = РК2. Без номера → дата. Без даты → ID-порядок.
Граница РК1 = `midterm_controls[0].end + 1 день` из акад.календаря.

## Ключевые файлы
- `src/lib/db.ts` — IndexedDB v3 (canvasCourses, canvasAssignments, platonusYears)
- `src/lib/canvas.ts` — валидация/применение синка, CANVAS_SYNC_ORIGINS
- `src/lib/platonus.ts` — валидация platonus-sync, PLATONUS_STORAGE_KEY
- `src/lib/backup.ts` — экспорт/restore ПОЛНОГО состояния (v2: subjects, schedules, calendars, platonusYears, canvasCourses, canvasAssignments, settings; v1-бекапы восстанавливаются, но sync-сторы не трогают)
- `src/lib/grade-scheme.ts` — titleWeekNumber(), computeCourseGrades() (РК-разбивка)
- `src/lib/aiContext.ts` — buildAdvisorContext() для AI
- `src/lib/aiClient.ts` — chatComplete() (OpenAI-compat + Gemini native)
- `src/lib/score-tone.ts` — scoreBadgeVariant()
- `src/lib/nav-items.ts` — useNavItems() (7 разделов)
- `src/components/layout/CanvasSyncListener.tsx` — postMessage + localStorage polling (8с), оба протокола
- `src/components/layout/DataManageModal.tsx` — просмотр/удаление/JSON-редактирование импортированного
- `src/components/grades/GradeCharts.tsx` — RatingBars + StatusDonut (recharts, lazy)
- `src/components/gpa/` + `src/pages/GpaPage.tsx` — GPA калькулятор (KZ 4.0 шкала, what-if)
- `src/pages/AdvisorPage.tsx` + `src/components/ai/WeeklyAdviceCard.tsx` — AI-чат и «Совет недели»
- `extension/` — MV3: manifest (canvas+platonus host_permissions), background.js (Canvas fetch + Platonus tab-harvest), popup.js (URL + оба синка + прогресс через storage.session)
- `userscript/aristos-sync.user.js` — Tampermonkey альтернатива
- `tools/curriculum-builder/` — отдельное веб-приложение: визуальный редактор JSON (пән/кесте/күнтізбе) + AI (omniroute/Gemini, PDF/изображения). 06.11: починен layout (горизонтальный скролл — скрытый file-инпут + min-width таблицы), импорт понимает ПОЛНЫЙ бекап aristos-backup с автороутингом (subjects→кітапхана по subject_id, schedules→`${course}-${semester}`, calendars→course, upsert), RU/KK переключатель и тёмная/светлая тема (lib/i18n.ts, styles.css через :root[data-theme], localStorage aristos-cb:*). 06.11 (вечер): редакторы переделаны — Кесте = доска дней со слотами 09:00–17:50 + drag&drop пар (PairCard.tsx, HTML5 DnD, вне-сеточные пары в «Басқа уақыт»), Пән/Күнтізбе = человеческие ярлыки + JSON-ключ + объяснение у каждого поля (FieldHead в bits.tsx), темы сгруппированы по типам (лекция/практика/СРСП/СӨЖ/басқа), +115 i18n-ключей × 2 локали
- `docs/canvas-lms.md`, `docs/platonus.md` — документация API для будущих сессий

## Текущее состояние (04.11.2026)
- **Сервер**: `vite preview --port 5174 --strictPort` (стабильный). Dev-серверы вызывали ECONNRESET + watcher misses.
- **Данные юзера**: Canvas 7 курсов / 233 тапсырма синкнуты. Платонус: 5 записей, 38 предметов (2024/1–2026/1). 1 курс появляется в меню из platonusYears (year-2023).
- **Сида больше НЕТ (04.11.2026)**: `src/lib/seed.ts` удалён, `Courses/` перемещена в `../private-data/Courses/` (вне репо и бандла — там личные данные юзера и телефоны преподавателей). Первый запуск = чистая база, всё через импорт JSON/бекапа. Кнопка «Деректерді қайта орнату» → clearAllData с confirm. ВАЖНО: git-история всё ещё содержит Courses/2course — перед пушем в публичный репо для Vercel либо squash-историю, либо приватный репо.
- **PDF тоже в привате (04.11.2026)**: `public/pdf/` (48 МБ УМКД) перемещён в `../private-data/pdf/`, из workbox globPatterns убран `pdf` (прекеш 49.5МБ → 1.1МБ). `pdf-map.ts` теперь отдаёт только `subject.pdfs` из JSON пәна (задаются в curriculum-builder); хардкодная SUBJECT_PDF_MAP удалена. Оффлайн-PDF для юзера — кандидат: загрузка PDF в IndexedDB блобами.
- **Расписание 3 курс**: юзер импортировал свой schedule.json — course надо поменять на 3 (было 1), valid_from 2026-04-21 похоже на опечатку PDF (остальные 2026-09-21).
- **Календарь 3 курс**: исходник теперь в `../private-data/Courses/3course/acad_calendar.json` — реальные даты из Платонуса (01.09–12.12, РК1 19–24.10, РК2 07–12.12, сессия 14.12–08.01).
- **Boot error diagnostic**: `index.html` имеет capture-хук error/rejection → показывает BOOT ERROR на пустом root.

## Известные проблемы
- Platonus-парсер v3 (07.11): карточки читаются СТРУКТУРНО (title-атрибут = полное «Название(Код)» — текст ссылки Платонус обрезает «...»; data-percent = донут; пары value/label из футера; data-id = subjectID) — v2 на regex по тексту терял длинные предметы и физкультуру (без Ср.тек), путал код у «Казахский (русский) язык 1(…)». Оценки по дням журнал кладёт в #marksModal ТОЛЬКО по клику на карточку (getMarks XHR): расширение кликает каждую карточку в hidden-табе и снимает модалку; все ожидания — на стороне воркера (таймеры скрытой вкладки Chrome троттлит до минуты после 5 мин в фоне). Разметка подтверждена живым дампом `tools/platonus-dump-sample.html`; тесты `node tools/test-platonus-parser.mjs` (jsdom). UI: субъект-строки «Платонус · тарих» открывают модалку с оценками по дням (как у Canvas).
- Практика/Тәжірибелік жұмыс без даты — распределяются по ID-порядку (эвристика), не идеально.
- 169/233 заданий без due_at — «Мерзімсіз» секция большая, можно свёрнуть.
- Userscript и extension дублируют логику (fetch+normalize) — при изменении API чинить в двух местах.

## Что осталось (по приоритету)
1. **Прогон Platonus-импорта v3** юзером (переустановить расширение → «Найти доступные периоды» → «Импорт выбранных») — проверить оценки по дням; если модалка съёмки где-то собьётся, скачать дамп кнопкой «HTML журнала» и приложить к калибровке.
2. **GPA-калькулятор** — работает, но нужны реальные кредиты из Платонуса/ИУП.
3. **AI-советник** — код готов, юзеру надо настроить ключ (omniroute или Gemini) в ⚙ на /advisor.
4. **AI-автосвязка курсов** (маппинг Canvas→Aristos по похожим названиям) — кнопка в CourseMappingModal.
5. Деплой: Vercel/CF Pages (без бекенда) → прод-URL в расширение.
6. Backups: авто-экспорт после синка.

## Команды
- Dev: `npm run dev` (НЕ использовать — флейки)
- Build: `npm run build`
- Serve: `npx vite preview --port 5174 --strictPort`
- Builder: `cd tools/curriculum-builder && npm run dev`
- Worker: `cd sync-worker && npx wrangler deploy` (README внутри)

## Деплой (04.11.2026)
- **Vercel**: `vercel.json` готов (SPA-rewrites для BrowserRouter + кэш sw.js/assets). Импорт репо в Vercel → framework Vite → deploy. После деплоя: (1) вписать прод-URL в `extension/popup.js` DEFAULT_URL; (2) в sync-worker/wrangler.toml ALLOWED_ORIGIN = прод-домен, редеплой воркера.
- **Cloud sync (готово, задеплоено 05.11)**: воркер https://aristos-sync.aristoss.workers.dev (аккаунт zxrd, KV 5bd447c5...ff0), ALLOWED_ORIGIN = список доменов (aristoss.vercel.app — прод-сайт, aristos-lovat — второй проект, localhost). URL вшит как DEFAULT_CLOUD_ENDPOINT в src/lib/cloud.ts — юзерам вводить его не надо. Воркер поддерживает comma-separated список origin. Юзер-флоу: код + passphrase + push/pull.
- **Оффлайн-PDF (готово)**: `pdfFiles` стор в IndexedDB v4 (блобы), `src/lib/pdf-store.ts`, UI «Жүктелген PDF» в SubjectDetailPage (editMode). Блобы НЕ попадают в бекап — только локально на устройстве.
- **Git**: история сквошнута в 1 коммит (старая с Courses/pdf — в локальном теге backup/pre-squash-2026-11-04, в публичный его НЕ пушить), force-push в origin. Репо zxrcode/aristos_v2 приватный.

## Нативный синк Canvas/Платонус (11.11.2026, v2 — без remote-IPC)
Remote-IPC с внешних страниц оказался ненадёжен (спиннер навсегда: сообщения не доходят). Пере-архитектура:
- **Canvas — полностью нативно без страниц**: `src-tauri/src/canvas.rs` — `canvas_session_state` (куки webview через `cookies_for_url` + быстрый GET /api/v1/users/self) и `canvas_sync_native` (reqwest с Cookie + X-CSRF-Token из куки `_csrf_token`, percent-decode; Link-пагинация ≤50; endpoints как в userscript; нормализация itemType/extractCode/оценки из enrollments в Rust). Команды async (deadlock cookies() на Windows). Логин: если сессии нет/умерла — видимому окну `sync_open(canvas login)` + поллинг `canvas_session_state` по кукам; куки персистентны между запусками. Инжект-скрипт canvas-collector удалён.
- **Платонус — инжект остался, доставка через title-канал**: драйвер (platonus-page.js) шлёт результат чанками в `document.title` (`ARISTOS_D|idx|total|chunk`), host поллит `sync_diag` (350 мс) и подтверждает чтение eval-ом (`window.__ARISTOS_ACK`); single-chunk сообщения без ACK. `waitPlatonusMessage` в native-sync.ts. IPC-путь (`sync_payload`) больше не используется драйвером (команда осталась).
- Стили виджетов (11.11): root wrap_content (фон по контенту, без пустоты), шапка с иконкой приложения (setImageViewResource ic_launcher) + акцентный title, двухколонные строки widget_row_event (время/дата акцентом #7DD3FC + название), дедлайны ≤4 строк, remote-IPC capability remote-sync.json остаётся (задел).

## Нативный синк Canvas/Платонус (09.11.2026, desktop, v1) — замена расширения
Механика как у расширения, но внутри приложения: скрытое/видимое webview-окно `harvest` (`src-tauri/src/sync.rs`: sync_open/sync_eval/sync_url/sync_close) грузит canvas/platonus; в него инжектятся самодостаточные скрипты `src/lib/injected/{canvas-collector,platonus-page}.js` — дословные порты userscript-коллектора (same-origin fetch + Link-пагинация + нормализация) и platonus-inpage (парсер карточек + click/probe/extract #marksModal, page-side setTimeout-поллинг — webview приложения не троттлится как MV3-таб). Результат — `invoke('sync_payload')` → событие `sync-payload` → `src/lib/native-sync.ts` (очередь сообщений, waitMessage, логин-флоу с поллингом sync_url) → валидация **существующими** isCanvasSyncPayload/isPlatonusSyncPayload → **существующие** useDB().syncCanvas/syncPlatonus (React-стейт + авто-маппинг + авто-push в облако). UI — `NativeSyncSection.tsx` в SideMenu (только `isTauri() && !isTauriMobile()`); этапы/ошибки — машина-ключи + новые i18n-ключи sync*.
- IPC с внешних страниц: `capabilities/remote-sync.json` (remote.urls canvas/platonus/id.yu.edu.kz → окно harvest, permission allow-sync-payload) + `withGlobalTauri: true` в tauri.conf.json (window.__TAURI__ на внешних страницах). Параметры драйверу подставляются перед телом скрипта (`window.__ARISTOS_PARAMS__`).
- Логин: при need-login окно логина (Canvas /login/canvas, Платонус SSO через id.yu.edu.kz) + поллинг sync_url до ухода со страницы входа (2 стабильных опроса) → ретрай. platonusStudentID — в settings store.
- Ошибки-машины: need-login/login-timeout/sync-already-running/sync-timeout/platonus-no-periods/platonus-empty/invalid-payload → перевод в NativeSyncSection.errorText.
- Payload: source: 'app' (union в types расширен); семантика applyCanvasSync (полный снапшот) сохранена.
- Известный нюанс: сессия webview живёт в данных приложения; при сбое — кнопка синка сама предложит окно логина.

## Канал обновлений (11.11.2026)
Воркер = хостинг релизов: PUT /api/app/file/:name + /api/app/meta (секрет X-App-Upload-Secret из wrangler.toml APP_UPLOAD_SECRET, CI читает его из этого же файла), GET /api/app/latest + /api/app/file/:name (публично, KV, лимит 25 МБ). CI после сборок: android заливает Aristos-<v>.apk; windows — NSIS exe+.sig; macos — .app.tar.gz+.sig; job publish-updates собирает latest.json (подписи minisign — pubkey в tauri.conf.json, приватный в src-tauri/keystore/aristos-updater.b64, пароль aristos-sign-2026) и meta. App: `src/lib/app-update.ts` + `UpdateSection.tsx` в SideMenu — Android: сравнение версий + openUrl(APK) через plugin-opener (ставится поверх, подпись стабильная); desktop: tauri-plugin-updater (downloadAndInstall + relaunch через plugin-process). AppImage 100 МБ в KV не влезает — Linux-апдейтер не хостится (deb вручную). Требует: `cd sync-worker && npx wrangler deploy` (новые endpoint'ы + APP_UPLOAD_SECRET).

## Tauri-миграция (09.11.2026)
PWA остаётся веб-дистрибуцией (Vercel, расширение завязано на неё); Tauri 2 — обёртка над тем же vite-билдом: desktop (Linux/Win/macOS через CI) + Android APK (sideload). iOS нативно НЕ делаем — там работает PWA (адд-хоумскрин; push в iOS-PWA — отдельная тема, вне скоупа).

### Ключевые решения
- **Router**: в Tauri — `HashRouter` (src/App.tsx, гейт `isTauri()`), на вебе прежний BrowserRouter. `src/lib/tauri.ts` — isTauri/isTauriMobile (UA-check, чтобы на десктопе не планировать «отложенные» уведомления — плагин доставил бы их мгновенно).
- **Уведомления**: `@tauri-apps/plugin-notification`. Мобильный Tauri: `src/lib/reminders.ts` планирует на 7 дней вперёд (пары за minutesBefore, дедлайны за 24 ч, учёт семестра/праздников) через `Schedule.at(...)` + `cancelAll()`; рефреш при открытии/визибле/6 ч/синках/смене настроек — через headless `NotificationAgent` (мобильная ветка). Веб/десктоп: прежний v0-тик (`notifyOncePerDay`), в Tauri транспорт — плагин (в notifications.ts). Каналы Android: aristos-lessons / aristos-deadlines. SideMenu: добавлен выбор minutesBefore (5/10/15/30) + async permission-статус в Tauri.
- **Виджеты Android (3 шт.)**: NextPairs (4×2), WeekSchedule (4×3), Deadlines (4×2) — Kotlin RemoteViews в оверлее `src-tauri/custom-android/` (копируется поверх gen/android в CI после `tauri android init`). Без JNI-плагина: Rust-команда `write_widget_data` кладёт JSON-снапшот (src/lib/widget-snapshot.ts: lessons/deadlines/semester/holidays/labels, все строки предлокализованы) в app_data_dir/widget_snapshot.json; провайдеры при КАЖДОМ рендере сами вычисляют «ближайшие пары/неделю/дедлайны» (WidgetData.kt) — контент не застывает. Тап → открытие приложения (PendingIntent launch). Обновления: updatePeriodMillis 30 мин + onResume в MainActivity (оверлей) + пуш снапшота при синках (NotificationAgent мобильная ветка). Community-плагин tauri_plugin_widgets — план Б (0.x, 1 мейнтейнер).
- **PDF**: Android WebView не рендерит PDF → новый роут `/pdf/:id` (`src/pages/PdfViewerPage.tsx`, pdfjs-dist), в Tauri `UploadedPdfs` навигирует туда, на вебе прежний window.open(blob). Работает и в PWA.
- **Cargo**: release-profile opt-level=s, БЕЗ lto (слабая машина; полный размер — не критерий). ProGuard minify НЕ включать (ломает notification-плагин).
- **Разрешения Android** (оверлей-манифест): INTERNET, POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, VIBRATE.

### Файлы Tauri
- `src-tauri/` — Cargo.toml, tauri.conf.json (identifier kz.yessenov.aristos, frontendDist ../dist), capabilities/default.json (notification:default + allow-write-widget-data), src/lib.rs (плагин + write_widget_data).
- `src-tauri/custom-android/` — оверлей: AndroidManifest.xml (+виджеты/разрешения), MainActivity.kt (onResume → refresh виджетов), widgets/{WidgetData,WidgetRenderer,NextPairs/WeekSchedule/DeadlinesWidgetProvider}.kt, res/{layout,drawable,xml}/widget_*.
- `src/lib/{tauri,reminders,widget-snapshot}.ts` + PdfViewerPage + гейты в App/SideMenu/NotificationAgent/UploadedPdfs; i18n-ключи notif*/widget*/pdfLoad*.
- `.github/workflows/release.yml` — теги v* + dispatch: desktop через tauri-action (ubuntu/windows/macos), Android job: JDK17 + SDK/NDK + `tauri android init` + overlay `cp -r custom-android/. gen/android/` + `tauri android build --apk` (universal 4 ABI, подпись из секретов ANDROID_KEYSTORE_B64/PASSWORD или эфемерный keystore → артефакт keystore.jks, СОХРАНИТЬ).

### Действия юзера после миграции
1. `cd sync-worker && npx wrangler deploy` — ALLOWED_ORIGIN дополнен `http://tauri.localhost,tauri://localhost` (cloud pull из Tauri).
2. Desktop локально: `npm run tauri build` (webkit2gtk-4.1 уже стоит) или `npm run tauri dev`.
3. Android: Actions → release → Run workflow → скачать android-apk (поставить, разрешить установку) + НЕ потерять keystore.jks; в Secrets задать ANDROID_KEYSTORE_B64 (base64) + ANDROID_KEYSTORE_PASSWORD при первом же удобном случае.
4. Push тега `v0.1.0` → GitHub Release с dmg/exe/deb/APK.
