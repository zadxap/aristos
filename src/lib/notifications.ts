/** Локальные уведомления: пары и дедлайны.
 *  Транспорт: в Tauri — нативный плагин (@tauri-apps/plugin-notification),
 *  на вебе/PWA — Notification API (через Service Worker, если доступен).
 *  На мобильном Tauri работают ещё и ЗАПЛАНИРОВАННЫЕ напоминания при
 *  закрытом приложении — см. reminders.ts; здесь только «пока открыто».
 *  Настройки и журнал показанного — на устройстве (localStorage). */

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification"
import { isTauri } from "@/lib/tauri"

export interface NotifSettings {
  /** предупреждать о начале пары */
  lessons: boolean
  /** напоминать о близких дедлайнах */
  deadlines: boolean
  /** за сколько минут предупреждать о паре */
  minutesBefore: number
  /** утренний дайджест: расписание дня одним уведомлением */
  digest: boolean
}

const SETTINGS_KEY = "aristos-notif-settings-v1"
const SHOWN_KEY = "aristos-notif-shown-v1"

/** Монохромная иконка и акцент для нативных уведомлений. ВАЖНО:
 *  plugins.notification в tauri.conf.json НЕ трогать — Rust-сторона
 *  плагина не объявляет конфиг, любая секция = abort при старте
 *  (PluginInitialization: «invalid type: map, expected unit»). Поэтому
 *  icon/iconColor задаются на каждое уведомление. */
export const NOTIF_ICON = "ic_notification"
export const NOTIF_ICON_COLOR = "#38BDF8"

const DEFAULT_SETTINGS: NotifSettings = {
  lessons: true,
  deadlines: true,
  minutesBefore: 5,
  digest: true,
}

export function notificationsSupported(): boolean {
  return isTauri() || (typeof window !== "undefined" && "Notification" in window)
}

export function notificationPermission():
  | NotificationPermission
  | "unsupported" {
  // В Tauri состояние плагина асинхронное; синхронно возвращаем default —
  // SideMenu уточняет его эффектом (permissionState).
  if (isTauri()) return "default"
  return notificationsSupported() ? Notification.permission : "unsupported"
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!notificationsSupported()) return "unsupported"
  try {
    if (isTauri()) return await requestPermission()
    return await Notification.requestPermission()
  } catch {
    return isTauri() ? "default" : Notification.permission
  }
}

export function loadNotifSettings(): NotifSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<NotifSettings>
    return {
      lessons: parsed.lessons ?? DEFAULT_SETTINGS.lessons,
      deadlines: parsed.deadlines ?? DEFAULT_SETTINGS.deadlines,
      minutesBefore:
        typeof parsed.minutesBefore === "number" && parsed.minutesBefore > 0
          ? parsed.minutesBefore
          : DEFAULT_SETTINGS.minutesBefore,
      digest: parsed.digest ?? DEFAULT_SETTINGS.digest,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveNotifSettings(settings: NotifSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* пусто */
  }
}

/** журнал: tag → день, когда показывали (чтобы не спамить при каждом тике) */
function shownMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "{}") as Record<
      string,
      string
    >
  } catch {
    return {}
  }
}

function markShown(tag: string, dayKey: string): void {
  try {
    const map = shownMap()
    map[tag] = dayKey
    // держим журнал компактным — чистим всё, что не сегодня
    const compact = Object.fromEntries(
      Object.entries(map).filter(([, d]) => d === dayKey)
    )
    localStorage.setItem(SHOWN_KEY, JSON.stringify(compact))
  } catch {
    /* пусто */
  }
}

/** Показать уведомление один раз в сутки на тег. В Tauri — нативный плагин,
 *  на вебе — через SW, если доступен (надёжнее в PWA), иначе конструктор. */
export async function notifyOncePerDay(
  tag: string,
  dayKey: string,
  title: string,
  body: string
): Promise<void> {
  if (!notificationsSupported()) return
  if (shownMap()[tag] === dayKey) return
  try {
    if (isTauri()) {
      if (!(await isPermissionGranted())) return
      markShown(tag, dayKey)
      await sendNotification({
        title,
        body,
        icon: NOTIF_ICON,
        iconColor: NOTIF_ICON_COLOR,
      })
      return
    }
    if (Notification.permission !== "granted") return
    markShown(tag, dayKey)
    const options: NotificationOptions & { badge?: string } = {
      body,
      tag,
      // Монохромный глиф на прозрачном: непрозрачный квадрат Android рисует
      // белым квадратом в шторке (asset: public/icons/notification-badge.svg).
      icon: "/icons/notification-badge.png",
      badge: "/icons/notification-badge.png",
    }
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(title, options)
    } else {
      new Notification(title, options)
    }
  } catch {
    /* уведомления не критичны */
  }
}
