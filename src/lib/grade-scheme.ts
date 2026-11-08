import type { CanvasAssignment, CanvasCourse, SemesterCalendar } from '@/types'

const EXAM_RE = /емтихан|экзамен|exam/i

export interface CourseGradeBreakdown {
  courseId: number
  /** graded/missed items counted per period */
  itemsRk1: number
  itemsRk2: number
  /** Ср.тек.1 / Ср.тек.2 — same values as РК1 / РК2 in the journal */
  srTek1: number | null
  srTek2: number | null
  rk1: number | null
  rk2: number | null
  rating: number | null
  exam: number | null
  /** Platonus scheme: round(0.6 * rating + 0.4 * exam) */
  final: number | null
  /** Canvas's own weighted total, for reference */
  canvasScore: number | null
}

function percent(item: CanvasAssignment): number | null {
  if (item.score !== null && item.points_possible > 0) return (item.score / item.points_possible) * 100
  if (item.missing) return 0 // a missed deadline counts as a zero, like Platonus does
  return null
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Local calendar day (YYYY-MM-DD) of an ISO timestamp — matches what the user sees in Canvas. */
function localDay(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * Weekly number from a title: «Тәжірибелік жұмыс №2», «Тест 10», «БӨЖ 1», «1 практика».
 * Teachers number these by study week, so the number says which РК period the mark belongs to.
 * Handles №-form, trailing and leading numbers («Практика №3», «тест 10», «1 практика»).
 */
export function titleWeekNumber(title: string): number | null {
  const noMatch = title.match(/№\s*(\d+)/)
  const leadMatch = title.match(/^\s*(\d+)\s+\D/)
  const tailMatch = title.match(/\b(\d+)\s*$/)
  const raw = noMatch ? noMatch[1] : leadMatch ? leadMatch[1] : tailMatch ? tailMatch[1] : null
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1 || n > 25) return null
  return n
}

function shiftDay(day: string, days: number): string {
  const d = new Date(day + 'T12:00:00')
  d.setDate(d.getDate() + days)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * Reproduces the university's grade scheme from Canvas data:
 * Ср.тек.1 (weeks up to the first midterm) = РК1, Ср.тек.2 = РК2,
 * Рейтинг = (РК1 + РК2) / 2, Итог = 0.6 * Рейтинг + 0.4 * Экзамен.
 * Period boundaries come from the academic calendar when available.
 * Dates are compared as local calendar days to avoid UTC shifts.
 */
export function computeCourseGrades(
  course: CanvasCourse,
  assignments: CanvasAssignment[],
  semester?: SemesterCalendar
): CourseGradeBreakdown {
  const courseItems = assignments.filter((item) => item.course_id === course.id)
  const examItems = courseItems.filter((item) => EXAM_RE.test(item.title))
  const regular = courseItems.filter((item) => !EXAM_RE.test(item.title))

  // РК1 boundary: end of the first midterm from the calendar (+1 night, so
  // Sunday-01:00 deadlines of the РК1 week stay in РК1), else start + 8 weeks
  let boundaryDay: string | null = null
  if (semester?.midterm_controls?.[0]?.end) {
    boundaryDay = shiftDay(semester.midterm_controls[0].end, 1)
  } else if (semester?.semester_start) {
    boundaryDay = shiftDay(semester.semester_start, 56)
  } else if (regular.length > 0) {
    const days = regular.map((item) => localDay(item.due_at!))
    boundaryDay = days[Math.floor(days.length / 2)]
  }

  const rk1Values: number[] = []
  const rk2Values: number[] = []
  const rk2Ids: number[] = []
  const undatedUnnumbered: CanvasAssignment[] = []

  // Period priority: weekly number in the title («…№N» = week N) → due date → id order
  for (const item of regular) {
    const p = percent(item)
    if (p === null) continue
    const week = titleWeekNumber(item.title)
    if (week !== null) {
      if (week <= 8) rk1Values.push(p)
      else {
        rk2Values.push(p)
        rk2Ids.push(item.id)
      }
      continue
    }
    if (item.due_at && boundaryDay) {
      if (localDay(item.due_at) <= boundaryDay) rk1Values.push(p)
      else {
        rk2Values.push(p)
        rk2Ids.push(item.id)
      }
      continue
    }
    undatedUnnumbered.push(item)
  }

  // Undated, unnumbered graded work: slot it by assignment id order — Canvas ids grow
  // with creation time, so items created before the earliest РК2 item belong to РК1.
  const rk2MinId = rk2Ids.length ? Math.min(...rk2Ids) : null
  for (const item of undatedUnnumbered) {
    const p = percent(item)
    if (p === null) continue
    if (rk2MinId !== null && item.id >= rk2MinId) rk2Values.push(p)
    else rk1Values.push(p)
  }

  const rk1 = rk1Values.length ? round2(avg(rk1Values) as number) : null
  const rk2 = rk2Values.length ? round2(avg(rk2Values) as number) : null
  const rating = rk1 !== null && rk2 !== null ? round2((rk1 + rk2) / 2) : null

  const examPercents = examItems
    .map(percent)
    .filter((p): p is number => p !== null)
  const exam = examPercents.length ? round2(avg(examPercents) as number) : null

  const final = rating !== null && exam !== null ? Math.round(0.6 * rating + 0.4 * exam) : null

  return {
    courseId: course.id,
    itemsRk1: rk1Values.length,
    itemsRk2: rk2Values.length,
    srTek1: rk1,
    srTek2: rk2,
    rk1,
    rk2,
    rating,
    exam,
    final,
    canvasScore: course.current_score,
  }
}
