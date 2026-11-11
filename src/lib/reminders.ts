/** Нативные напоминания под Tauri на мобильных: планируем уведомления на
 *  неделю вперёд из локальных данных — срабатывают при закрытом приложении.
 *  На вебе/PWA и на десктопе не используется (там работает in-app агент —
 *  NotificationAgent, а на десктопе плагин доставил бы «запланированное»
 *  немедленно). Логика отбора повторяет фильтры NotificationAgent.
 *
 *  Контент: заголовок = предмет/название теста (важное первым и меньше
 *  обрезается), тело = «Сабақ жақында · 09:00 · аудитория». Однотипные
 *  уведомления объединяются в группы (group-ключи) — шторка сворачивает
 *  стек. Плюс утренний дайджест дня (InboxStyle, тихий канал). */

import {
  cancelAll,
  createChannel,
  Importance,
  isPermissionGranted,
  Schedule,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { isTauriMobile } from '@/lib/tauri'
import { effectiveDeadline } from '@/lib/canvas'
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
/** Дайджест — тихий канал отдельно от «сабақ басталды» (важность Default). */
const CHANNEL_DIGEST = 'aristos-digest'
const GROUP_LESSONS = 'aristos-lessons'
const GROUP_DEADLINES = 'aristos-deadlines'
const GROUP_DIGEST = 'aristos-digest'
/** Дайджест приходит утром, до пар; строк в развёрнутом списке — до 8. */
const DIGEST_HOUR = 7
const DIGEST_MINUTE = 30
const DIGEST_MAX_LINES = 8

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
  await createChannel({
    id: CHANNEL_DIGEST,
    name: kk.notifDigest,
    importance: Importance.Default,
  })
  channelsReady = true
}

interface ReminderEvent {
  id: number
  title: string
  body: string
  /** Развёрнутый текст (BigTextStyle): полный предмет/название в шторке. */
  largeBody?: string
  /** Список строк (InboxStyle) — только у дайджеста. */
  inboxLines?: string[]
  /** Подпись стиля: «Aristos» под развёрнутым текстом. */
  summary?: string
  /** Группа в шторке: однотипные уведомления сворачиваются в стек. */
  group?: string
  fireAt: number
  channel: string
}

export function computeReminderEvents(input: ReminderInput): ReminderEvent[] {
  const settings = loadNotifSettings()
  const now = Date.now()
  const horizon = now + (HORIZON_DAYS + 1) * DAY
  const events: ReminderEvent[] = []

  // 1) Пары по дням: ближайшие HORIZON_DAYS дней (общая выборка для
  //    напоминаний перед парами и утреннего дайджеста). Вне семестра
  //    и в праздники — тишина (как в NotificationAgent).
  const sem = input.calendar?.semesters?.find(
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
    const lessons = (input.schedule?.schedule || [])
      .filter((e) => e.day.toLowerCase() === dow)
      .sort((a, b) => a.start.localeCompare(b.start))
    if (lessons.length === 0) continue

    // 1а) Напоминание за minutesBefore до начала каждой пары.
    if (settings.lessons) {
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
        const place = `${lesson.start}${lesson.room ? ` · ${lesson.room}` : ''}`
        events.push({
          id: hashId(`lesson-${dayKey}-${lesson.start}`),
          title: lesson.subject_name,
          body: `${kk.notifLessonTitle} · ${place}`,
          largeBody: `${lesson.subject_name} · ${place}`,
          group: GROUP_LESSONS,
          fireAt,
          channel: CHANNEL_LESSONS,
        })
      }
    }

    // 1б) Утренний дайджест дня: список пар одним тихим уведомлением.
    if (settings.digest) {
      const fireAt = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        DIGEST_HOUR,
        DIGEST_MINUTE
      ).getTime()
      if (fireAt > now && fireAt <= horizon) {
        events.push({
          id: hashId(`digest-${dayKey}`),
          title: kk.notifDigestTitle(lessons.length),
          body: kk.notifDigestFirst(lessons[0].start),
          inboxLines: lessons
            .slice(0, DIGEST_MAX_LINES)
            .map((l) => `${l.start} — ${l.subject_name}`),
          summary: 'Aristos',
          group: GROUP_DIGEST,
          fireAt,
          channel: CHANNEL_DIGEST,
        })
      }
    }
  }

  // 2) Дедлайны Canvas: не сданные, за 24 часа до эффективного дедлайна
  //    (Срок → «Доступно до»; если уже ближе — сразу).
  if (settings.deadlines) {
    for (const assignment of input.canvasAssignments ?? []) {
      const dueIso = effectiveDeadline(assignment)
      if (!dueIso || assignment.submitted_at) continue
      const due = Date.parse(dueIso)
      if (Number.isNaN(due) || due <= now || due > horizon) continue
      const fireAt = Math.max(now + 60_000, due - DAY)
      const dueStr = `${isoDay(new Date(due))} ${dueIso.slice(11, 16)}`
      events.push({
        id: hashId(`deadline-${assignment.id}`),
        title: assignment.title,
        body: `${kk.notifDeadlineTitle}: ${dueStr}`,
        largeBody: `${assignment.title} — ${dueStr}`,
        group: GROUP_DEADLINES,
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
          largeBody: e.largeBody,
          inboxLines: e.inboxLines,
          summary: e.summary,
          group: e.group,
          channelId: e.channel,
          schedule: Schedule.at(new Date(e.fireAt), false, true),
        })
      )
    )
  } catch {
    /* напоминания не критичны — молча */
  }
}
