/** Снапшот данных для Android-виджетов: приложение пишет JSON в файлы
 *  приложения (Rust-команда write_widget_data), Kotlin-провайдеры читают
 *  его при рендере (src-tauri/custom-android/.../widgets/) и сами вычисляют
 *  «ближайшие пары», неделю и дедлайны от текущего момента.
 *  Формат машинный: локализация строк (labels/days) и пары «HH:MM» —
 *  виджет рендерит как есть, поэтому контент всегда актуален на момент
 *  обновления, даже если приложение давно не открывалось. */

import { invoke } from '@tauri-apps/api/core'
import { kk, getLang } from '@/i18n'
import { isTauri } from '@/lib/tauri'
import type {
  AcadCalendar,
  CanvasAssignment,
  CanvasCourseMap,
  Schedule as WeekSchedule,
} from '@/types'

export interface WidgetSnapshot {
  v: 1
  updatedAt: string
  lang: string
  labels: {
    today: string
    tomorrow: string
    schedule: string
    deadlines: string
    empty: string
    noDeadlines: string
  }
  days: Record<string, string>
  daysFull: Record<string, string>
  lessons: Array<{
    day: string
    start: string
    end: string
    name: string
    room: string | null
    type: string | null
  }>
  deadlines: Array<{ id: number; title: string; course: string; dueAt: string }>
  semester: { start: string; end: string } | null
  holidays: Array<{ start: string; end: string }>
}

export interface WidgetInput {
  schedule: WeekSchedule | null | undefined
  calendar: AcadCalendar | null | undefined
  activeSemester: number
  canvasAssignments: CanvasAssignment[] | null | undefined
  canvasCourseMap: CanvasCourseMap
}

const DAY = 24 * 60 * 60 * 1000
/** Дедлайны берём с запасом 14 дней; просрочку старше 6 часов не показываем. */
const DEADLINE_WINDOW_DAYS = 14
const MAX_DEADLINES = 20

export function buildWidgetSnapshot(input: WidgetInput): WidgetSnapshot {
  const sem =
    input.calendar?.semesters?.find((s) => s.semester === input.activeSemester) ??
    null
  const now = new Date()
  const nowMs = now.getTime()
  const horizon = nowMs + DEADLINE_WINDOW_DAYS * DAY

  const deadlines = (input.canvasAssignments ?? [])
    .filter((a) => a.due_at && !a.submitted_at)
    .map((a) => ({ a, due: Date.parse(a.due_at as string) }))
    .filter(
      (x) =>
        !Number.isNaN(x.due) &&
        x.due >= nowMs - 6 * 60 * 60 * 1000 &&
        x.due <= horizon
    )
    .sort((x, y) => x.due - y.due)
    .slice(0, MAX_DEADLINES)
    .map((x) => ({
      id: x.a.id,
      title: x.a.title,
      course: input.canvasCourseMap[String(x.a.course_id)] ?? '',
      dueAt: x.a.due_at as string,
    }))

  return {
    v: 1,
    updatedAt: now.toISOString(),
    lang: getLang(),
    labels: {
      today: kk.widgetToday,
      tomorrow: kk.widgetTomorrow,
      schedule: kk.widgetSchedule,
      deadlines: kk.widgetDeadlines,
      empty: kk.widgetEmpty,
      noDeadlines: kk.widgetNoDeadlines,
    },
    days: { ...kk.days },
    daysFull: { ...kk.daysFull },
    lessons: (input.schedule?.schedule ?? []).map((e) => ({
      day: e.day,
      start: e.start,
      end: e.end,
      name: e.subject_name,
      room: e.room ?? null,
      type: e.type ?? null,
    })),
    deadlines,
    semester: sem
      ? { start: sem.semester_start, end: sem.semester_end }
      : null,
    holidays: (sem?.holidays ?? []).map((h) => ({ start: h.start, end: h.end })),
  }
}

/** Записать снапшот для виджетов (только Tauri; Rust кладёт JSON в
 *  app-каталог Android). Ошибки молча — виджеты не критичны. */
export async function pushWidgetSnapshot(input: WidgetInput): Promise<void> {
  if (!isTauri()) return
  try {
    const snapshot = buildWidgetSnapshot(input)
    await invoke('write_widget_data', { data: JSON.stringify(snapshot) })
  } catch {
    /* виджеты не критичны — молча */
  }
}
