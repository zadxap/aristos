/**
 * Calculates the current academic week number based on semester start date.
 * Returns 1-based week number, clamped between 1 and totalWeeks if specified.
 */
export function getAcademicWeek(
  date: Date,
  semesterStart: string,
  totalWeeks = 15
): number {
  const start = new Date(semesterStart)
  
  // Set both dates to beginning of local day for clean date diff
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const currentDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

  const diffMs = currentDay - startDay
  if (diffMs < 0) {
    return 1 // Before semester starts
  }

  const weekNum = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
  return Math.min(Math.max(weekNum, 1), totalWeeks)
}
