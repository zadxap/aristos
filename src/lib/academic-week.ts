/**
 * Учебные недели семестра.
 *
 * Якорь — ПОНЕДЕЛЬНИК недели, в которой начинается семестр. Пары живут по
 * неделям Пн–Вс, и если дата старта падает на середину недели (напр.
 * 01.09.2026 — вторник при парами с понедельника 31.08), неделей 1 считается
 * та, что началась в понедельник. Считать строго от даты старта («01.09 + 7n»)
 * — значит получить номер на 1 меньше реального: 09.11.2026 (понедельник) —
 * 10-я неделя от 01.09, но 11-я от 31.08, и все тултипы сетки недель
 * съезжают на день.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** «2026-09-01» → локальная полночь этой даты (new Date(iso) даёт UTC-полночь). */
function localDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

/** Понедельник недели, содержащей дату старта семестра. */
export function semesterWeekAnchor(semesterStart: string): Date {
  const start = localDay(semesterStart)
  const backToMonday = (start.getDay() + 6) % 7 // пн→0, вт→1, … вс→6
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() - backToMonday)
}

/** Дата (понедельник) учебной недели week — для тултипов сетки недель. */
export function weekStartDate(semesterStart: string, week: number): Date {
  const anchor = semesterWeekAnchor(semesterStart)
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + (week - 1) * 7)
}

/**
 * Calculates the current academic week number based on semester start date.
 * Returns 1-based week number, clamped between 1 and totalWeeks if specified.
 */
export function getAcademicWeek(
  date: Date,
  semesterStart: string,
  totalWeeks = 15
): number {
  const anchor = semesterWeekAnchor(semesterStart).getTime()
  const currentDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

  const diffMs = currentDay - anchor
  if (diffMs < 0) {
    return 1 // Before semester starts
  }

  const weekNum = Math.floor(diffMs / WEEK_MS) + 1
  return Math.min(Math.max(weekNum, 1), totalWeeks)
}
