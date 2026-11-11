import type { CanvasAssignment, CanvasCourse, PlatonusYearRecord, SemesterCalendar } from '@/types'
import { effectiveDeadline } from '@/lib/canvas'
import { getAcademicWeek } from '@/lib/academic-week'

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
    const days = regular
      .map((item) => effectiveDeadline(item))
      .filter((d): d is string => d !== null)
      .map((d) => localDay(d))
      .sort()
    boundaryDay = days[Math.floor(days.length / 2)] ?? null
  }

  // Недели 1–15: НЕДЕЛЯ = среднее баллов работ этой недели; РК1 = среднее
  // недельных средних недель 1–8, РК2 = недель 9–15 — ровно как официальный
  // LTI-тул, который передаёт в Платонус недельные средние по понедельникам.
  // Проверено на INOPAK 2026/1: РК1 74.54, РК2 94.25, Рейтинг 84.40 — сходится
  // точно (прежняя модель «среднее всех работ РК» давала 75.56/92.33).
  const weekValues = new Map<number, number[]>() // неделя → проценты работ
  const extraRk1: number[] = [] // без даты и без номера (деградированный режим)
  const extraRk2: number[] = []
  const rk2Ids: number[] = [] // id работ РК2 — для распределения недатированных
  const undatedUnnumbered: CanvasAssignment[] = []

  // Неделя работы — общий хелпер assignmentWeek (календарная неделя дедлайна,
  // номер из названия только без даты; без даты и номера — старые фолбэки)
  // Period priority: calendar week of the deadline → title №N → boundary/id order
  for (const item of regular) {
    const p = percent(item)
    if (p === null) continue
    const week = assignmentWeek(item, semester)
    if (week !== null) {
      const list = weekValues.get(week) ?? []
      list.push(p)
      weekValues.set(week, list)
      if (week > 8) rk2Ids.push(item.id)
      continue
    }
    // дата для РК-разбивки: Срок или «Доступно до» (lock_at)
    const dueIso = effectiveDeadline(item)
    if (dueIso && boundaryDay) {
      if (localDay(dueIso) <= boundaryDay) extraRk1.push(p)
      else extraRk2.push(p)
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
    if (rk2MinId !== null && item.id >= rk2MinId) extraRk2.push(p)
    else extraRk1.push(p)
  }

  // РК = среднее недельных средних недель своего периода; работы без даты/номера
  // идут одной синтетической «неделей» на РК (их среднее участвует как один элемент)
  const meanOfWeeks = (from: number, to: number, extra: number[]): number | null => {
    const weekMeans: number[] = []
    for (let w = from; w <= to; w++) {
      const list = weekValues.get(w)
      const m = list && list.length ? avg(list) : null
      if (m !== null) weekMeans.push(m)
    }
    const extraMean = extra.length ? avg(extra) : null
    if (extraMean !== null) weekMeans.push(extraMean)
    return weekMeans.length ? round2(avg(weekMeans) as number) : null
  }
  const countItems = (from: number, to: number, extra: number[]): number => {
    let n = extra.length
    for (let w = from; w <= to; w++) n += weekValues.get(w)?.length ?? 0
    return n
  }

  const rk1 = meanOfWeeks(1, 8, extraRk1)
  const rk2 = meanOfWeeks(9, 15, extraRk2)
  const rating = rk1 !== null && rk2 !== null ? round2((rk1 + rk2) / 2) : null

  const examPercents = examItems
    .map(percent)
    .filter((p): p is number => p !== null)
  const exam = examPercents.length ? round2(avg(examPercents) as number) : null

  const final = rating !== null && exam !== null ? Math.round(0.6 * rating + 0.4 * exam) : null

  return {
    courseId: course.id,
    itemsRk1: countItems(1, 8, extraRk1),
    itemsRk2: countItems(9, 15, extraRk2),
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

/**
 * Учебная неделя работы: сначала КАЛЕНДАРНАЯ неделя эффективного дедлайна
 * (Срок due_at, а без него «Доступно до» lock_at) от понедельника недели
 * старта семестра — так же группирует официальный LTI-тул, чьи РК уходят в
 * Платонус: «БӨЖ №1» со «Доступно до 27.09» = 4-апта, несмотря на №1 в
 * названии. Номер из названия — только когда даты нет.
 */
export function assignmentWeek(
  item: CanvasAssignment,
  semester?: SemesterCalendar
): number | null {
  const dueIso = effectiveDeadline(item)
  if (dueIso && semester?.semester_start) {
    return getAcademicWeek(new Date(dueIso), semester.semester_start, semester.total_weeks ?? 15)
  }
  return titleWeekNumber(item.title)
}

export type AdmissionRatingSource = 'canvas' | 'platonus' | 'computed'

/**
 * Рейтинг допуска курса — «быстрый статус» в дашборде. Приоритет источников:
 *  1. canvas — официальный итог Canvas (если грейдбук снова начнут считать);
 *  2. platonus — «Рейтинг» из журнала Платонуса: вуз считает РК в LTI-тулзе
 *     и передаёт её в Платонус, так что журнал содержит ОФИЦИАЛЬНЫЕ числа
 *     (агрегация тулзы по датам не совпадает с нашей по №N — расхождение ~0.5);
 *  3. computed — вычисленный из тапсырм по схеме РК1/РК2 (что выше).
 * Берём запись с максимальным годом/термином, содержащую код курса.
 */
export function courseAdmissionRating(
  course: CanvasCourse,
  assignments: CanvasAssignment[],
  platonusYears: PlatonusYearRecord[],
  semester?: SemesterCalendar
): { value: number | null; source: AdmissionRatingSource } {
  if (course.current_score !== null) return { value: course.current_score, source: 'canvas' }

  const records = [...platonusYears].sort((a, b) => (b.year - a.year) || (b.term - a.term))
  for (const record of records) {
    const subject = record.subjects.find((s) => s.code === course.code)
    if (subject && subject.rating !== null) return { value: subject.rating, source: 'platonus' }
  }

  return { value: computeCourseGrades(course, assignments, semester).rating, source: 'computed' }
}
