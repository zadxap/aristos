import type {
  CanvasAssignment,
  CanvasCourse,
  CanvasCourseMap,
  CanvasItemType,
  CanvasSyncPayload,
  Subject,
} from '@/types'
import {
  clearCanvasData,
  getAllCanvasAssignments,
  getAllCanvasCourses,
  saveCanvasAssignments,
  saveCanvasCourses,
  saveSetting,
  getSetting,
} from './db'

export const CANVAS_ORIGIN = 'https://canvas.yu.edu.kz'

/** Origins a sync message may arrive from: the userscript's page and this app itself (dev/tests). */
export const CANVAS_SYNC_ORIGINS = [CANVAS_ORIGIN, typeof window !== 'undefined' ? window.location.origin : '']

export interface CanvasSyncMessage {
  type: 'aristos-canvas-sync'
  payload: CanvasSyncPayload
}

export interface CanvasSyncResultMessage {
  type: 'aristos-canvas-sync-result'
  ok: boolean
  error?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number'
}

export function isCanvasCourse(value: unknown): value is CanvasCourse {
  if (!isRecord(value)) return false
  return typeof value.id === 'number' && typeof value.name === 'string' && typeof value.code === 'string' &&
    isNullableNumber(value.current_score) && isNullableString(value.current_grade)
}

const ITEM_TYPES = new Set<CanvasItemType>(['assignment', 'quiz', 'discussion', 'other'])

export function isCanvasAssignment(value: unknown): value is CanvasAssignment {
  if (!isRecord(value)) return false
  return typeof value.id === 'number' && typeof value.course_id === 'number' &&
    typeof value.title === 'string' && ITEM_TYPES.has(value.type as CanvasItemType) &&
    isNullableString(value.due_at) && typeof value.points_possible === 'number' &&
    typeof value.html_url === 'string' && isNullableString(value.submitted_at) &&
    isNullableNumber(value.score) && typeof value.graded === 'boolean' &&
    typeof value.late === 'boolean' && typeof value.missing === 'boolean'
}

export function isCanvasSyncPayload(value: unknown): value is CanvasSyncPayload {
  if (!isRecord(value)) return false
  return value.format === 'aristos-canvas-sync' && value.version === 1 &&
    typeof value.syncedAt === 'string' && typeof value.source === 'string' &&
    Array.isArray(value.courses) && value.courses.every(isCanvasCourse) &&
    Array.isArray(value.assignments) && value.assignments.every(isCanvasAssignment)
}

export function isCanvasSyncMessage(value: unknown): value is CanvasSyncMessage {
  return isRecord(value) && value.type === 'aristos-canvas-sync' && isCanvasSyncPayload(value.payload)
}

/**
 * Store a fresh sync: replaces canvas stores wholesale (Canvas is the source of
 * truth for this data) and remembers the sync time. Keeps course mapping.
 */
export async function applyCanvasSync(payload: CanvasSyncPayload): Promise<void> {
  if (payload.assignments.length > 0 || payload.courses.length > 0) {
    await clearCanvasData()
  }
  await saveCanvasCourses(payload.courses)
  await saveCanvasAssignments(payload.assignments)
  await saveSetting('canvasLastSync', payload.syncedAt)
}

export async function getCanvasCourseMap(): Promise<CanvasCourseMap> {
  return getSetting<CanvasCourseMap>('canvasCourseMap', {})
}

export async function saveCanvasCourseMap(map: CanvasCourseMap): Promise<void> {
  await saveSetting('canvasCourseMap', map)
}

/** Pull everything needed to render the canvas UI in one call. */
export async function loadCanvasData(): Promise<{
  courses: CanvasCourse[]
  assignments: CanvasAssignment[]
  lastSync: string | null
  courseMap: CanvasCourseMap
}> {
  const [courses, assignments, lastSync, courseMap] = await Promise.all([
    getAllCanvasCourses(),
    getAllCanvasAssignments(),
    getSetting<string | null>('canvasLastSync', null),
    getCanvasCourseMap(),
  ])
  return { courses, assignments, lastSync, courseMap }
}

/** "Система баз данных (SBD 113242-1-L)" -> "SBD 113242-1-L" */
export function extractCourseCode(name: string): string {
  const match = name.match(/\(([^()]+)\)\s*$/)
  return (match ? match[1] : name).trim()
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(([^()]+)\)\s*$/, '') // drop trailing "(CODE)"
    .replace(/[\s«»"'.:,;()\-–—]/g, '')
    .trim()
}

/**
 * Best-effort auto mapping by course title. Kazakh/Russian titles rarely match
 * exactly, so this is only a convenience default — the user can always override.
 */
export function autoMapCourse(course: CanvasCourse, subjects: Subject[]): string | null {
  const target = normalizeName(course.name)
  if (!target) return null
  const exact = subjects.find((subject) => normalizeName(subject.subject_name) === target)
  if (exact) return exact.subject_id
  const partial = subjects.find((subject) => {
    const a = normalizeName(subject.subject_name)
    return a.length > 6 && (a.includes(target) || target.includes(a))
  })
  return partial?.subject_id ?? null
}

/** Build a starting map: keep manual choices, auto-map the rest. */
export function buildAutoCourseMap(
  courses: CanvasCourse[],
  subjects: Subject[],
  existing: CanvasCourseMap
): CanvasCourseMap {
  const map: CanvasCourseMap = { ...existing }
  for (const course of courses) {
    if (map[String(course.id)] === undefined) {
      map[String(course.id)] = autoMapCourse(course, subjects)
    }
  }
  return map
}
