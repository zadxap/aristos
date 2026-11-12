# Улучшение виджетов и уведомлений Android

## Контекст

На скриншотах видны две реальные проблемы:

**Уведомления.** Снимок шторки — это PWA-транспорт (подпись «aristoss.v…» = origin от Chrome): в `notifyOncePerDay` (`src/lib/notifications.ts:132-133`) и `icon`, и `badge` = непрозрачный синий `icon-192.png`, который Android рисует белым/серым квадратом. Нативный APK-путь не лучше: иконка не задана → плагин подставляет системный `ic_dialog_info` (`getDefaultSmallIcon`, TauriNotificationManager.kt:448-460). Заголовок «Сабақ жақында» обрезается («Сабақ жақ…») и не несёт информации — предмет сидит в теле. Плагин 2.8.0 поддерживает `icon`/`iconColor`/`largeBody`/`inboxLines`/`group`/`groupSummary` (проверено в исходниках плагина), но приложение не использует ничего, кроме title/body/channelId.

**Виджеты.** Палитра жёстко зашита в XML/Kotlin тёмная (`#E60B1220` фон, `#7DD3FC` акцент, `WidgetRenderer.kt` + `res/layout/widget_*.xml`), светлая тема обоев не поддерживается. Нет подсветки срочных дедлайнов (<24 ч) и «сегодня» в виджете недели.

Выбрано пользователем: светлая+тёмная тема виджетов; из уведомлений — группировка и дайджест дня.

## 1. Иконка и акцент уведомлений (обе поставки)

- **Новый** `src-tauri/custom-android/app/src/main/res/drawable/ic_notification.xml` — vector drawable: белый глиф «A» (по мотивам лого, простая геометрия) на прозрачном фоне, `android:tint` не нужен (белый fill).
- `src-tauri/tauri.conf.json`: в `plugins` добавить `"notification": { "icon": "ic_notification", "iconColor": "#38BDF8" }` (рядом с `updater`). Это дефолтные smallIcon + setColor для всех нативных уведомлений.
- **Новый** `public/icons/notification-badge.png` (192×192, белый глиф на прозрачном) — сгенерировать из маленького SVG (`rsvg-convert`, fallback ImageMagick `magick`). В `src/lib/notifications.ts` (`notifyOncePerDay`, web-ветка) использовать его для `icon` и `badge`.

## 2. Контент уведомлений + группировка

`src/lib/reminders.ts` — `computeReminderEvents` / `ReminderEvent`:
- **Пары**: `title = lesson.subject_name`, `body = ${kk.notifLessonTitle} · ${lesson.start}${room}`, `largeBody = ${subject_name} · ${start}${room}` (развёрнутый текст в шторке), `group = "aristos-lessons"`.
- **Дедлайны**: `title = assignment.title`, `body = ${kk.notifDeadlineTitle}: ${dueStr}`, `largeBody = ${assignment.title} — ${dueStr}` (полное длинное название в развёрнутом виде), `group = "aristos-deadlines"`.
- `sendNotification` прокидывает новые поля (типы `Options` в `@tauri-apps/plugin-notification` их содержат: `largeBody`, `summary`, `group`).

`src/components/layout/NotificationAgent.tsx` (web-тик, строки 84–89 и 105–110) — та же перестановка title/body для PWA-пути.

Группировка на нативном APK — только `group`-ключи; Android 7+ сам строит автосводку стека. Отдельную groupSummary-жёткую сводку не планируем (контент застыл бы между обновлениями).

## 3. Дайджест дня

- `src/lib/notifications.ts`: в `NotifSettings` добавить `digest: boolean` (default `true`), в `SideMenu.tsx` — тумблер рядом с существующими (паттерн уже есть), i18n-ключи.
- `src/lib/reminders.ts`:
  - `CHANNEL_DIGEST = 'aristos-digest'` в `ensureChannels`: `Importance.Default`, без вибрации/огней (тихий канал, можно выключить отдельно).
  - В `computeReminderEvents`: для каждого из 7 дней (в семестре, не праздник, ≥1 пара) — событие `fireAt = 07:30` локального дня (если ещё не прошло), `id = hashId("digest-{dayKey}")`, `title = kk.notifDigestTitle` («Бүгін {n} сабақ» / ru «Сегодня {n} пары» — плюрализация через маленький helper для ru: 1 парa/2–4 пары/5+ пар), `body = kk.notifDigestFirst` («Бірінші сабақ — 09:00»), `inboxLines` = до 8 строк `${start} — ${subject}` (свинговый стиль разворачивается в списке), `summary = "Aristos"`, `channel = CHANNEL_DIGEST`.
- Web/PWA (`NotificationAgent.tsx`): при `settings.digest` на первом тике дня ≥ 07:30 → `notifyOncePerDay("digest-{todayKey}", …, title, body = "09:00 A · 10:00 B …")` (Web Notification API не умеет inboxLines).
- i18n `src/i18n/{kk,ru}.ts`: `notifDigest` (название канала/тумблера), `notifDigestTitle`, `notifDigestFirst`.

## 4. Виджеты: светлая/тёмная палитра + акценты

`src-tauri/custom-android/.../widgets/WidgetRenderer.kt`:
- `data class Palette(bgRes, header, time, text, day, muted, urgent)`; `fun palette(context: Context)` — по `context.resources.configuration.uiMode and UI_MODE_NIGHT_MASK`.
  - Тёмная (как сейчас): `widget_bg`, header/time `0xFF7DD3FC`, text `0xFFE2E8F0`, day `0xFF93C5FD`, muted `0xFF94A3B8`, urgent `0xFFFB923C`.
  - Светлая: **новый** `res/drawable/widget_bg_light.xml` (`#F1F5F9` @ ~90%, corners 18dp), header `0xFF0284C7`, time `0xFF0369A1`, text `0xFF0F172A`, day `0xFF1D4ED8`, muted `0xFF64748B`, urgent `0xFFEA580C`.
- `root()`: после создания views — `views.setInt(R.id.widget_root, "setBackgroundResource", palette.bgRes)`; палитра передаётся в `applyHeader` (цвет заголовка), `addEventRow` (цвет времени, параметр `urgent: Boolean = false`), `addTextRow` (muted из палитры). Цвета ставятся рантайм-`setTextColor` всегда — XML-цвета остаются как фоллбек.
- `DeadlinesWidgetProvider.buildViews`: `urgent = dl.dueAtMillis - now < 24ч` → время строки оранжевым.
- `WeekScheduleWidgetProvider.buildViews`: текущий день недели (через `java.util.Calendar`, маппинг в ключи `mon/sun`) → имя дня цветом `palette.header` + суффикс ` · ${snap.labels["today"]}`.
- `NextPairsWidgetProvider` — просто пробрасывает палитру.

`android:description` для `widget_*_info.xml` не добавляем: оверлей не может дополнить сгенерированный `values/strings.xml` (cp перезапишет `app_name` — сломает сборку).

## 5. Документация

`docs/tauri.md`: §4 (канал дайджеста, `plugins.notification.icon/iconColor`, группировка, largeBody), §5 (адаптивная палитра виджетов, акценты) — в стиле существующих записей.

## Файлы

| Действие | Файл |
|---|---|
| new | `src-tauri/custom-android/app/src/main/res/drawable/ic_notification.xml`, `…/drawable/widget_bg_light.xml`, `public/icons/notification-badge.png` |
| edit | `src-tauri/tauri.conf.json`, `src/lib/reminders.ts`, `src/lib/notifications.ts`, `src/components/layout/NotificationAgent.tsx`, `src/components/layout/SideMenu.tsx`, `src/i18n/kk.ts`, `src/i18n/ru.ts`, `…/widgets/{WidgetRenderer,DeadlinesWidgetProvider,WeekScheduleWidgetProvider,NextPairsWidgetProvider}.kt`, `docs/tauri.md` |

## Проверка

1. `npm run build` — тайпчек всего фронтенда.
2. Kotlin/Android локально собрать нельзя (SDK в системе нет) — сборка через CI: workflow-dispatch `.github/workflows/release.yml`, артефакт `android-apk` → поставить, проверить: монохромный глиф в статус-баре, тинт акцента, стек групп в шторке, три канала в настройках системы (включая тихий «дайджест»), светлая тема виджета на светлых обоях / тёмная на тёмных, оранжевое время у дедлайна <24 ч, « · бүгін» у сегодняшнего дня.
3. Дайджест: сместить системное время на ~07:31 (или временно поменять DIGEST-константу) — проверить и нативный, и PWA вариант (PWA — в Chrome с выданным разрешением, тик раз в минуту).
4. PWA-иконка: `npm run dev`, уведомление через `notifyOncePerDay` в консоли — белый глиф вместо квадрата.
