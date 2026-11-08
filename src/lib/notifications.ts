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
}

const SETTINGS_KEY = "aristos-notif-settings-v1"
const SHOWN_KEY = "aristos-notif-shown-v1"

const DEFAULT_SETTINGS: NotifSettings = {
  lessons: true,
  deadlines: true,
  minutesBefore: 5,
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
      await sendNotification({ title, body })
      return
    }
    if (Notification.permission !== "granted") return
    markShown(tag, dayKey)
    const options: NotificationOptions & { badge?: string } = {
      body,
      tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
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
