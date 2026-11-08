/** Нативные напоминания под Tauri на мобильных: планируем уведомления на
 *  неделю вперёд из локальных данных — срабатывают при закрытом приложении.
 *  На вебе/PWA и на десктопе не используется (там работает in-app агент —
 *  NotificationAgent, а на десктопе плагин доставил бы «запланированное»
 *  немедленно). Логика отбора повторяет фильтры NotificationAgent. */

import {
  cancelAll,
  createChannel,
  Importance,
  isPermissionGranted,
  Schedule,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { isTauriMobile } from '@/lib/tauri'
import { loadNotifSettings } from '@/lib/notifications'
import { kk } from '@/i18n'
import type { AcadCalendar, CanvasAssignment } from '@/types'

/** Weekly schedule из src/types (имя совпадает с Schedule плагина). */
type WeekSchedule = import('@/types').Schedule

export interface ReminderInput {
  schedule: WeekSchedule | null | undefined
  calendar: AcadCalendar | null | undefined
  activeSemester: number
  canvasAssignments: CanvasAssignment[] | null | undefined
}

const DAY = 24 * 60 * 60 * 1000
/** Горизонт планирования: пары повторяются еженедельно, due_at известны
 *  заранее — недели хватает; при каждом открытии приложения окно продлевается. */
const HORIZON_DAYS = 7
const MAX_EVENTS = 100
const CHANNEL_LESSONS = 'aristos-lessons'
const CHANNEL_DEADLINES = 'aristos-deadlines'

let channelsReady = false

/** Детерминированный положительный int32 — id уведомления. */
function hashId(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h & 0x7fffffff) || 0x7fffffff
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function ensureChannels(): Promise<void> {
  if (channelsReady) return
  await createChannel({
    id: CHANNEL_LESSONS,
    name: kk.notifLessons,
    importance: Importance.High,
    vibration: true,
    lights: true,
  })
  await createChannel({
    id: CHANNEL_DEADLINES,
    name: kk.notifDeadlines,
    importance: Importance.High,
    vibration: true,
    lights: true,
  })
  channelsReady = true
}

interface ReminderEvent {
  id: number
  title: string
  body: string
  fireAt: number
  channel: string
}

export function computeReminderEvents(input: ReminderInput): ReminderEvent[] {
  const settings = loadNotifSettings()
  const now = Date.now()
  const horizon = now + (HORIZON_DAYS + 1) * DAY
  const events: ReminderEvent[] = []

  // 1) Пары: ближайшие HORIZON_DAYS дней, уведомление за minutesBefore до начала.
  //    Вне семестра и в праздники — тишина (как в NotificationAgent).
  if (settings.lessons && input.schedule && input.calendar) {
    const sem = input.calendar.semesters?.find(
      (s) => s.semester === input.activeSemester
    )
    for (let offset = 0; offset <= HORIZON_DAYS; offset++) {
      const day = new Date(now + offset * DAY)
      const dayKey = isoDay(day)
      const inSemester =
        sem && dayKey >= sem.semester_start && dayKey <= sem.semester_end
      const isHoliday = sem?.holidays?.some(
        (h) => dayKey >= h.start && dayKey <= h.end
      )
      if (!inSemester || isHoliday) continue
      const dow = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][day.getDay()]
      const lessons = (input.schedule.schedule || [])
        .filter((e) => e.day.toLowerCase() === dow)
        .sort((a, b) => a.start.localeCompare(b.start))
      for (const lesson of lessons) {
        const [h, m] = lesson.start.split(':').map(Number)
        if (Number.isNaN(h) || Number.isNaN(m)) continue
        const lessonAt = new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          h,
          m
        ).getTime()
        const fireAt = lessonAt - settings.minutesBefore * 60_000
        if (fireAt <= now || fireAt > horizon) continue
        const key = `lesson-${isoDay(new Date(lessonAt))}-${lesson.start}`
        events.push({
          id: hashId(key),
          title: kk.notifLessonTitle,
          body: `${lesson.subject_name} · ${lesson.start}${lesson.room ? ` · ${lesson.room}` : ''}`,
          fireAt,
          channel: CHANNEL_LESSONS,
        })
      }
    }
  }

  // 2) Дедлайны Canvas: не сданные, за 24 часа до due_at (если уже ближе — сразу).
  if (settings.deadlines) {
    for (const assignment of input.canvasAssignments ?? []) {
      if (!assignment.due_at || assignment.submitted_at) continue
      const due = Date.parse(assignment.due_at)
      if (Number.isNaN(due) || due <= now || due > horizon) continue
      const fireAt = Math.max(now + 60_000, due - DAY)
      const dueStr = `${isoDay(new Date(due))} ${assignment.due_at.slice(11, 16)}`
      events.push({
        id: hashId(`deadline-${assignment.id}`),
        title: kk.notifDeadlineTitle,
        body: `${assignment.title} — ${dueStr}`,
        fireAt,
        channel: CHANNEL_DEADLINES,
      })
    }
  }

  events.sort((a, b) => a.fireAt - b.fireAt)
  return events.slice(0, MAX_EVENTS)
}

/** Перепланировать все нативные напоминания (cancelAll + свежий набор).
 *  Вызывается при открытии приложения, после синков и при смене настроек. */
export async function refreshNativeReminders(
  input: ReminderInput
): Promise<void> {
  if (!isTauriMobile()) return
  try {
    if (!(await isPermissionGranted())) return
    await ensureChannels()
    const events = computeReminderEvents(input)
    await cancelAll()
    await Promise.all(
      events.map((e) =>
        sendNotification({
          id: e.id,
          title: e.title,
          body: e.body,
          channelId: e.channel,
          schedule: Schedule.at(new Date(e.fireAt), false, true),
        })
      )
    )
  } catch {
    /* напоминания не критичны — молча */
  }
}
