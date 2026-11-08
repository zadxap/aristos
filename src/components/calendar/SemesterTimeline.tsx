import { useMemo } from "react"
import type { AcadCalendar, DateRange } from "@/types"
import { kk } from "@/i18n"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getAcademicWeek } from "@/lib/academic-week"
import { cn } from "@/lib/utils"

interface SemesterTimelineProps {
  calendar: AcadCalendar
  activeSemester: number
  todayKey: string
}

/** «2026-09-01» → «01.09.2026» */
const fmt = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`
}

const daysBetween = (start: string, end: string) => {
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1)
}

interface Period {
  key: string
  name: string
  range: DateRange
  tone: "primary" | "purple" | "rose" | "amber" | "emerald"
}

const TONE_DOT: Record<Period["tone"], string> = {
  primary: "bg-primary",
  purple: "bg-purple-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
}

/** Вид «Семестр» на странице календаря: сетка учебных недель + хронология
 *  ключевых периодов (ориентация, РК, практики, сессия, оценивание, праздники). */
export function SemesterTimeline({
  calendar,
  activeSemester,
  todayKey,
}: SemesterTimelineProps) {
  const sem = calendar?.semesters?.find((s) => s.semester === activeSemester)

  const periods = useMemo<Period[]>(() => {
    if (!sem) return []
    const out: Period[] = []
    if (sem.orientation_week?.start)
      out.push({
        key: "orient",
        name: kk.orientationWeek,
        range: sem.orientation_week,
        tone: "primary",
      })
    sem.midterm_controls?.forEach((mc, i) =>
      out.push({
        key: `mc-${i}`,
        name: mc.name || kk.midterm,
        range: mc,
        tone: "purple",
      })
    )
    sem.holidays?.forEach((h, i) =>
      out.push({
        key: `h-${i}`,
        name: h.name || kk.holidayName,
        range: h,
        tone: "amber",
      })
    )
    calendar.practices?.forEach((p, i) =>
      out.push({
        key: `p-${i}`,
        name: p.name || kk.practiceName,
        range: p,
        tone: "emerald",
      })
    )
    if (sem.exam_period?.start)
      out.push({
        key: "exam",
        name: kk.examSession,
        range: sem.exam_period,
        tone: "rose",
      })
    if (calendar.grading_period?.start)
      out.push({
        key: "grading",
        name: kk.gradingPeriod,
        range: calendar.grading_period,
        tone: "primary",
      })
    return out
      .filter((p) => p.range.start && p.range.end)
      .sort((a, b) => a.range.start.localeCompare(b.range.start))
  }, [sem, calendar])

  if (!sem) {
    return (
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-6 text-center text-xs text-muted-foreground">
          {kk.calEmpty}
        </CardContent>
      </Card>
    )
  }

  const currentWeek = getAcademicWeek(
    new Date(),
    sem.semester_start,
    sem.total_weeks
  )
  const weeks = Array.from({ length: sem.total_weeks }, (_, i) => i + 1)
  const weekDateRange = (w: number) => {
    const start = new Date(sem.semester_start)
    start.setDate(start.getDate() + (w - 1) * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    return `${fmt(iso(start))} — ${fmt(iso(end))}`
  }

  return (
    <div className="min-w-0 space-y-5">
      {/* Семестр: шапка */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="blue" className="text-xs font-medium">
              {calendar.academic_year}
            </Badge>
            <Badge variant="secondary" className="text-xs font-medium">
              {kk.courseNo(calendar.course)}
            </Badge>
            <span className="text-xs font-medium text-muted-foreground">
              {kk.semester} {sem.semester}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {fmt(sem.semester_start)} — {fmt(sem.semester_end)}
          </p>
          <p className="text-xs text-muted-foreground">
            {kk.calWeeksTotal(sem.total_weeks)}
          </p>
        </CardContent>
      </Card>

      {/* Учебные недели */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              {kk.semesterWeeksTitle}
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {kk.academicWeekOf(currentWeek)}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-10">
            {weeks.map((w) => {
              const isCurrent = w === currentWeek
              const isPast = w < currentWeek
              return (
                <div
                  key={w}
                  title={weekDateRange(w)}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-lg text-xs font-semibold tabular-nums transition-colors",
                    isCurrent
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : isPast
                        ? "bg-primary/10 text-primary/70"
                        : "bg-muted/40 text-muted-foreground"
                  )}
                >
                  {w}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Ключевые периоды — хронология */}
      {periods.length > 0 && (
        <div className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {kk.academicPeriods}
          </h3>
          <div className="space-y-2">
            {periods.map((p) => {
              const isNow = todayKey >= p.range.start && todayKey <= p.range.end
              const isPast = todayKey > p.range.end
              const days = daysBetween(p.range.start, p.range.end)
              return (
                <div
                  key={p.key}
                  className={cn(
                    "flex min-w-0 items-center gap-3 rounded-xl border bg-card p-3 transition-colors",
                    isNow
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/70",
                    isPast && "opacity-60"
                  )}
                >
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      TONE_DOT[p.tone]
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {fmt(p.range.start)} — {fmt(p.range.end)}
                      {days !== null ? ` · ${kk.calPeriodDays(days)}` : ""}
                    </p>
                  </div>
                  {isNow && (
                    <Badge variant="blue" className="shrink-0 text-[10px]">
                      {kk.periodNow}
                    </Badge>
                  )}
                  {isPast && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {kk.periodPast}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
