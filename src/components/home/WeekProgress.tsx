import { Progress } from '@/components/ui/progress'
import { kk } from '@/i18n'
import { getAcademicWeek } from '@/lib/academic-week'
import type { AcadCalendar } from '@/types'

interface WeekProgressProps {
  calendar: AcadCalendar | undefined
  activeSemester: number
}

export function WeekProgress({ calendar, activeSemester }: WeekProgressProps) {
  const now = new Date()
  const activeSem = calendar?.semesters?.find((s) => s.semester === activeSemester)
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isInSemester = Boolean(activeSem && todayKey >= activeSem.semester_start && todayKey <= activeSem.semester_end)
  const totalWeeks = activeSem?.total_weeks || 15
  const currentWeek = activeSem
    ? getAcademicWeek(now, activeSem.semester_start, totalWeeks)
    : 1

  // Format today's date in Kazakh
  const dayIndex = now.getDay()
  const dayKey = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[dayIndex]
  const dayName = kk.daysFull[dayKey]
  const monthName = kk.months[now.getMonth()]
  const dateStr = `${now.getDate()} ${monthName}, ${dayName}`

  const progressPercent = isInSemester ? Math.min(Math.round((currentWeek / totalWeeks) * 100), 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground capitalize">
            {dateStr}
          </h2>
        </div>
        <div className="text-xs font-medium text-muted-foreground">
          {isInSemester ? <><span className="text-primary font-semibold">{currentWeek}</span><span> / {totalWeeks} {kk.week}</span></> : <span>{kk.outOfSemester}</span>}
        </div>
      </div>
      <Progress value={progressPercent} className="h-1.5" />
    </div>
  )
}
