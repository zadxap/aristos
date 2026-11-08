import { useState, useMemo, useEffect } from "react"
import { useAristosDB } from "@/context/DBContext"
import { kk } from "@/i18n"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAcademicWeek } from "@/lib/academic-week"
import { SemesterTimeline } from "@/components/calendar/SemesterTimeline"
import type { DayOfWeek, ScheduleEntry } from "@/types"
import { ChevronLeft, ChevronRight } from "lucide-react"

const DAY_KEYS_ORDER: DayOfWeek[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
]
const JS_DAY_TO_KEY: DayOfWeek[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
]

function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0")
  const d = String(day).padStart(2, "0")
  return `${year}-${m}-${d}`
}

export function CalendarPage() {
  const {
    activeCourse,
    availableCourses,
    setActiveCourse,
    activeSemester,
    availableSemesters,
    setActiveSemester,
    schedule,
    calendar,
    todayKey,
  } = useAristosDB()

  const today = new Date()
  const currentDateKey = formatDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )

  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth())
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear())
  const [selectedDateKey, setSelectedDateKey] = useState<string>(currentDateKey)
  // вид страницы: сетка месяца или таймлайн семестра
  const [view, setView] = useState<"month" | "semester">("month")

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const [year, month] = todayKey.split("-").map(Number)
      setCurrentMonth(month - 1)
      setCurrentYear(year)
      setSelectedDateKey(todayKey)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [todayKey])

  const activeSem = calendar?.semesters?.find(
    (s) => s.semester === activeSemester
  )

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  // Calculate days in month grid
  const daysGrid = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
    const totalDays = lastDayOfMonth.getDate()

    // 0 = Sun, 1 = Mon ... In Kazakh grid: Mon = 0 ... Sun = 6
    let startingDayOfWeek = firstDayOfMonth.getDay() - 1
    if (startingDayOfWeek === -1) startingDayOfWeek = 6

    const days: ({ dayNumber: number; dateKey: string } | null)[] = []

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    for (let d = 1; d <= totalDays; d++) {
      days.push({
        dayNumber: d,
        dateKey: formatDateKey(currentYear, currentMonth, d),
      })
    }

    return days
  }, [currentYear, currentMonth])

  // Helper to determine special status of a date
  const getDateStatus = (dateKey: string) => {
    if (!activeSem) return null

    // Holidays
    if (activeSem.holidays) {
      for (const h of activeSem.holidays) {
        if (dateKey >= h.start && dateKey <= h.end) {
          return {
            type: "holiday",
            name: h.name || kk.holidayName,
            color: "amber",
          }
        }
      }
    }

    // Exam
    if (activeSem.exam_period) {
      const { start, end } = activeSem.exam_period
      if (dateKey >= start && dateKey <= end) {
        return { type: "exam", name: kk.examSession, color: "rose" }
      }
    }

    // Midterm
    if (activeSem.midterm_controls) {
      for (const mc of activeSem.midterm_controls) {
        if (dateKey >= mc.start && dateKey <= mc.end) {
          return {
            type: "midterm",
            name: mc.name || kk.midterm,
            color: "purple",
          }
        }
      }
    }

    // Practices
    if (calendar?.practices) {
      for (const p of calendar.practices) {
        if (dateKey >= p.start && dateKey <= p.end) {
          return {
            type: "practice",
            name: p.name || kk.practiceName,
            color: "emerald",
          }
        }
      }
    }

    return null
  }

  // Selected date details
  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDateKey.split("-").map(Number)
    return new Date(y, m - 1, d)
  }, [selectedDateKey])

  const selectedDayKey = JS_DAY_TO_KEY[selectedDateObj.getDay()]
  const selectedDateStatus = getDateStatus(selectedDateKey)
  const selectedDateInSemester = Boolean(
    activeSem &&
    selectedDateKey >= activeSem.semester_start &&
    selectedDateKey <= activeSem.semester_end
  )

  const selectedDayLessons: ScheduleEntry[] =
    !schedule ||
    !selectedDateInSemester ||
    selectedDateStatus?.type === "holiday" ||
    selectedDateStatus?.type === "exam"
      ? []
      : (schedule.schedule || [])
          .filter((e) => e.day.toLowerCase() === selectedDayKey)
          .sort((a, b) => a.start.localeCompare(b.start))

  const selectedDateWeek = activeSem
    ? getAcademicWeek(
        selectedDateObj,
        activeSem.semester_start,
        activeSem.total_weeks
      )
    : 1

  return (
    <div className="min-w-0 space-y-5">
      {/* Top Selector: Course & Semester */}
      <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border/80 bg-card p-2 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <span className="pl-1 text-xs font-medium text-muted-foreground">
            {kk.course}:
          </span>
          <div className="grid grid-cols-4 gap-1">
            {availableCourses.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCourse(c)}
                className={`size-8 rounded-lg text-xs font-semibold transition-all ${
                  activeCourse === c
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {kk.semesterShort}:
          </span>
          <div className="flex gap-1">
            {availableSemesters.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSemester(s)}
                className={`size-8 rounded-lg text-xs font-semibold transition-all ${
                  activeSemester === s
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* View switcher: месяц / академический календарь семестра */}
      <div className="grid min-w-0 grid-cols-2 gap-1.5 rounded-xl border border-border/60 bg-muted/40 p-1">
        <button
          onClick={() => setView("month")}
          className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
            view === "month"
              ? "bg-card font-semibold text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {kk.calViewMonth}
        </button>
        <button
          onClick={() => setView("semester")}
          className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
            view === "semester"
              ? "bg-card font-semibold text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {kk.calViewSemester}
        </button>
      </div>

      {view === "semester" ? (
        calendar ? (
          <SemesterTimeline
            calendar={calendar}
            activeSemester={activeSemester}
            todayKey={currentDateKey}
          />
        ) : (
          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-6 text-center text-xs text-muted-foreground">
              {kk.calEmpty}
            </CardContent>
          </Card>
        )
      ) : (
        <>
          {/* Calendar Month Navigation */}
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
            <Card className="min-w-0 overflow-hidden border-border/80 shadow-xs">
              <div className="flex items-center justify-between border-b border-border/60 p-4">
                <button
                  onClick={handlePrevMonth}
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-sm font-bold text-foreground capitalize">
                  {kk.months[currentMonth]} {currentYear}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              {/* Month Day Names */}
              <div className="p-3">
                <div className="mb-1 grid grid-cols-7 gap-1 text-center">
                  {DAY_KEYS_ORDER.map((d) => (
                    <div
                      key={d}
                      className="py-1 text-[11px] font-semibold text-muted-foreground"
                    >
                      {kk.days[d]}
                    </div>
                  ))}
                </div>

                {/* Month Day Grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {daysGrid.map((item, idx) => {
                    if (!item) {
                      return <div key={`empty-${idx}`} className="h-10" />
                    }

                    const isToday = item.dateKey === currentDateKey
                    const isSelected = item.dateKey === selectedDateKey
                    const status = getDateStatus(item.dateKey)

                    let statusDot = null
                    if (status) {
                      const colorMap: Record<string, string> = {
                        amber: "bg-amber-500",
                        rose: "bg-rose-500",
                        purple: "bg-purple-500",
                        emerald: "bg-emerald-500",
                      }
                      statusDot = (
                        <span
                          className={`size-1 rounded-full ${
                            colorMap[status.color] || "bg-primary"
                          }`}
                        />
                      )
                    }
                    const todayDot = isToday ? (
                      <span className="size-1 rounded-full bg-primary" />
                    ) : null

                    return (
                      <button
                        key={item.dateKey}
                        onClick={() => setSelectedDateKey(item.dateKey)}
                        className={`flex h-10 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium transition-all ${
                          isSelected
                            ? "bg-primary font-bold text-primary-foreground shadow-xs"
                            : isToday
                              ? "border border-primary/40 bg-primary/10 font-bold text-primary"
                              : status?.type === "holiday"
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : status?.type === "exam"
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                                  : "text-foreground hover:bg-muted/60"
                        }`}
                      >
                        <span>{item.dayNumber}</span>
                        {(todayDot || statusDot) && (
                          <span className="flex h-1 items-center gap-0.5">
                            {todayDot}
                            {statusDot}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-around gap-2 border-t border-border/50 bg-muted/20 p-3 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary" />
                  <span>{kk.today}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rose-500" />
                  <span>{kk.examSession}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-500" />
                  <span>{kk.holidayName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-purple-500" />
                  <span>{kk.midtermShort}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>{kk.practiceName}</span>
                </div>
              </div>
            </Card>

            {/* Selected Day Details Card */}
            <Card className="border-border/80 shadow-xs">
              <CardContent className="min-w-0 space-y-3 p-4">
                <div className="flex flex-col items-start justify-between gap-2 border-b border-border/50 pb-2 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground capitalize sm:text-base">
                      {selectedDateObj.getDate()}{" "}
                      {kk.months[selectedDateObj.getMonth()]},{" "}
                      {kk.daysFull[selectedDayKey]}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {selectedDateInSemester
                        ? kk.academicWeekOf(selectedDateWeek)
                        : kk.outOfSemester}
                    </p>
                  </div>

                  {selectedDateStatus && (
                    <Badge
                      variant={
                        selectedDateStatus.color === "rose"
                          ? "destructive"
                          : selectedDateStatus.color === "amber"
                            ? "amber"
                            : "purple"
                      }
                      className="max-w-full text-xs whitespace-normal"
                    >
                      {selectedDateStatus.name}
                    </Badge>
                  )}
                </div>

                {/* Lessons for selected day */}
                {selectedDayLessons.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    {selectedDateStatus
                      ? kk.noLessonsPeriod(selectedDateStatus.name)
                      : kk.noLessonsToday}
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <span className="block text-xs font-semibold text-muted-foreground">
                      {kk.daySchedule} (
                      {kk.lessonsCount(selectedDayLessons.length)}
                      ):
                    </span>
                    <div className="space-y-2">
                      {selectedDayLessons.map((l, i) => (
                        <div
                          key={`${l.start}-${i}`}
                          className="flex min-w-0 flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <span className="block font-semibold break-words text-foreground sm:line-clamp-2">
                              {l.subject_name}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {l.room ? `${l.room} • ` : ""}
                              {l.teacher || ""}
                            </span>
                          </div>
                          <span className="w-fit shrink-0 rounded-md bg-primary/10 px-2 py-1 font-mono text-[11px] font-semibold text-primary">
                            {l.start} - {l.end}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
