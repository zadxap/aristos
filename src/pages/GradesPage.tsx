import { useMemo, useState, Suspense, lazy } from "react"
import { ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { kk } from "@/i18n"
import { useAristosDB } from "@/context/DBContext"
import {
  computeCourseGrades,
  titleWeekNumber,
  type CourseGradeBreakdown,
} from "@/lib/grade-scheme"
import { scoreBadgeVariant } from "@/lib/score-tone"
import { cn } from "@/lib/utils"
import type {
  CanvasAssignment,
  CanvasCourse,
  PlatonusMark,
  PlatonusSubject,
  PlatonusYearRecord,
} from "@/types"

const GradeCharts = lazy(() => import("@/components/grades/GradeCharts"))

const TONE_TEXT: Record<string, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  outline: "text-muted-foreground",
}

const TONE_STROKE: Record<string, string> = {
  emerald: "#10b981",
  blue: "#3b82f6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  outline: "var(--muted-foreground)",
}

/** Platonus-style donut: итог курса в процентах */
function Donut({ value }: { value: number | null }) {
  const size = 92
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = value !== null ? Math.max(0, Math.min(100, value)) : 0
  const tone = scoreBadgeVariant(value)

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
        />
      </svg>
      <span
        className={cn(
          "absolute text-sm font-bold tabular-nums",
          TONE_TEXT[tone]
        )}
      >
        {value !== null ? `${value.toFixed(0)}%` : "—"}
      </span>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/40 px-1.5 py-2 text-center sm:px-2">
      <p className="truncate text-[10px] leading-tight text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-semibold text-foreground tabular-nums sm:text-sm">
        {value !== null ? value.toFixed(2) : "—"}
      </p>
    </div>
  )
}

/** Graded work grouped by ACADEMIC WEEK — работы одной недели стоят общим блоком.
 *  Номер из названия («Практика №2» = 2-апта) — первичный источник; датированная
 *  работа без номера попадает в неделю, на которую приходится дата; и только
 *  работы без номера и без даты уходят в хвостовую группу. */
function MarksDetail({ courseId }: { courseId: number }) {
  const { canvasAssignments, calendar, activeSemester } = useAristosDB()

  const groups = useMemo(() => {
    const marks = canvasAssignments.filter(
      (item) =>
        item.course_id === courseId && (item.score !== null || item.missing)
    )

    const sem = calendar?.semesters?.find((s) => s.semester === activeSemester)
    const semStart = sem ? new Date(`${sem.semester_start}T00:00:00`) : null
    const totalWeeks = sem?.total_weeks ?? 15

    // дата → учебная неделя (fallback для работ без номера в названии)
    function weekFromDate(item: CanvasAssignment): number | null {
      const dateRef = item.submitted_at ?? item.due_at
      if (!dateRef || !semStart) return null
      const date = new Date(dateRef)
      if (Number.isNaN(date.getTime())) return null
      const week =
        Math.floor((date.getTime() - semStart.getTime()) / 86_400_000 / 7) + 1
      return week >= 1 && week <= totalWeeks ? week : null
    }

    const byWeek = new Map<number, CanvasAssignment[]>()
    const unknown: CanvasAssignment[] = []
    for (const item of marks) {
      const week = titleWeekNumber(item.title) ?? weekFromDate(item)
      if (week === null) {
        unknown.push(item)
        continue
      }
      if (!byWeek.has(week)) byWeek.set(week, [])
      byWeek.get(week)!.push(item)
    }
    // внутри недели: датированные по времени, бездатные — в конец блока
    for (const items of byWeek.values()) {
      items.sort((a, b) =>
        (a.submitted_at ?? a.due_at ?? "9999").localeCompare(
          b.submitted_at ?? b.due_at ?? "9999"
        )
      )
    }
    const result = [...byWeek.entries()].sort((a, b) => a[0] - b[0])
    if (unknown.length > 0) result.push([-1, unknown]) // -1 = без номера и без даты
    return result
  }, [canvasAssignments, courseId, calendar, activeSemester])

  if (groups.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        {kk.marksEmpty}
      </p>
    )
  }

  return (
    <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
      {groups.map(([week, items]) => (
        <div key={week}>
          {week === -1 ? (
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {kk.marksUndated}
            </p>
          ) : (
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {kk.weekShort(week)}
              </span>
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {week <= 8 ? kk.rk1 : kk.rk2} · {items.length}
              </span>
            </div>
          )}
          <div className="space-y-1">
            {items.map((item) => {
              const weekInTitle =
                week === -1 ? titleWeekNumber(item.title) : null
              return (
                <a
                  key={item.id}
                  href={item.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
                >
                  {weekInTitle !== null ? (
                    <span className="w-12 shrink-0 rounded-md bg-primary/10 px-1 py-0.5 text-center text-[10px] font-semibold text-primary">
                      {kk.weekShort(weekInTitle)}
                    </span>
                  ) : (
                    <span className="w-12 shrink-0 text-muted-foreground tabular-nums">
                      {(item.submitted_at ?? item.due_at)
                        ? `${new Date(item.submitted_at ?? item.due_at!).getDate()} ${kk.months[new Date(item.submitted_at ?? item.due_at!).getMonth()].slice(0, 3).toLowerCase()}`
                        : "—"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.late && (
                    <Badge
                      variant="amber"
                      className="shrink-0 px-1.5 py-0 text-[10px]"
                    >
                      {kk.statusLate}
                    </Badge>
                  )}
                  <span
                    className={cn(
                      "shrink-0 font-semibold tabular-nums",
                      item.score === null && "text-destructive"
                    )}
                  >
                    {item.score ?? 0} / {item.points_possible}
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Плакат-детали Платонуса: оценки по дням, сгруппированные по дисциплине
 *  курса (-L лекция / -P практика / -SRSP СРСП) — как в модалке самого Платонуса. */
function platonusKindLabel(kind: PlatonusMark["kind"]): string {
  if (kind === "lecture") return kk.platonusKindLecture
  if (kind === "practice") return kk.platonusKindPractice
  if (kind === "srsp") return kk.platonusKindSrsp
  return kk.platonusKindOther
}

/** Сетка «Месяц / Дата / Оценка» одной дисциплины — точно как в модалке Платонуса:
 *  месяц шапкой с colspan, под ним дни и баллы. */
function PlatonusMarksGrid({ items }: { items: PlatonusMark[] }) {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date))
  const cells = sorted
    .filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.date))
    .map((m) => ({
      day: Number(m.date.slice(8, 10)),
      month: Number(m.date.slice(5, 7)),
      mark: m.mark,
    }))
  if (cells.length === 0) return null

  // последовательные одинаковые месяцы объединяем в colspan-группы
  const spans: { month: number; count: number }[] = []
  for (const c of cells) {
    const last = spans[spans.length - 1]
    if (last && last.month === c.month) last.count++
    else spans.push({ month: c.month, count: 1 })
  }
  const monthName = (m: number) => {
    const raw = kk.months[m - 1] ?? ""
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full border-collapse text-center text-[11px] tabular-nums">
        <tbody>
          <tr>
            <th className="sticky left-0 z-10 border-r-2 border-border/70 bg-muted px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">
              {kk.platonusGridMonth}
            </th>
            {spans.map((s, i) => (
              <th
                key={i}
                colSpan={s.count}
                className={cn(
                  "border-b border-l border-border/70 bg-muted px-1.5 py-1.5 font-semibold",
                  i > 0 && "border-l-2"
                )}
              >
                {monthName(s.month)}
              </th>
            ))}
          </tr>
          <tr>
            <th className="sticky left-0 z-10 border-r-2 border-border/70 bg-muted px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">
              {kk.platonusGridDate}
            </th>
            {cells.map((c, i) => {
              const isMonthStart = i === 0 || cells[i - 1].month !== c.month
              return (
                <td
                  key={i}
                  className={cn(
                    "border-b border-l border-border/40 px-1.5 py-1 text-muted-foreground",
                    isMonthStart && "border-l-2 border-l-border/70"
                  )}
                >
                  {c.day}
                </td>
              )
            })}
          </tr>
          <tr>
            <th className="sticky left-0 z-10 border-r-2 border-border/70 bg-muted px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">
              {kk.platonusGridMark}
            </th>
            {cells.map((c, i) => {
              const isMonthStart = i === 0 || cells[i - 1].month !== c.month
              return (
                <td
                  key={i}
                  className={cn(
                    "border-l border-border/40 px-1.5 py-1 font-semibold",
                    isMonthStart && "border-l-2 border-l-border/70",
                    c.mark === 0 && "text-muted-foreground"
                  )}
                >
                  {c.mark}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function PlatonusMarksDetail({ marks }: { marks: PlatonusMark[] }) {
  if (marks.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        {kk.platonusMarksEmpty}
      </p>
    )
  }

  const groups = new Map<string, PlatonusMark[]>()
  for (const mark of marks) {
    if (!groups.has(mark.code)) groups.set(mark.code, [])
    groups.get(mark.code)!.push(mark)
  }

  return (
    <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
      {[...groups.entries()].map(([code, items]) => (
        <div key={code + items[0].date}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {platonusKindLabel(items[0].kind)}
            </span>
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {code || "—"} · {items.length}
            </span>
          </div>
          <PlatonusMarksGrid items={items} />
        </div>
      ))}
    </div>
  )
}

function CourseGradeCard({
  course,
  breakdown,
  onOpen,
}: {
  course: CanvasCourse
  breakdown: CourseGradeBreakdown
  onOpen: () => void
}) {
  return (
    <Card className="min-w-0 overflow-hidden border-border/80 shadow-xs">
      <CardContent className="min-w-0 space-y-3 p-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <button onClick={onOpen} className="min-w-0 flex-1 text-left">
            <p
              className="line-clamp-2 text-sm leading-snug font-semibold transition-colors hover:text-primary"
              title={course.name}
            >
              {course.name}
            </p>
            <Badge variant="blue" className="mt-1 px-1.5 py-0 text-[10px]">
              {course.code}
            </Badge>
          </button>
          <a
            href={`https://canvas.yu.edu.kz/courses/${course.id}/grades`}
            target="_blank"
            rel="noreferrer"
            title={kk.openInCanvas}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>

        <button
          onClick={onOpen}
          className="flex w-full items-center justify-center py-1"
        >
          <Donut value={breakdown.final} />
        </button>

        {/* 6 стат: на мобиле 2 колонки, иначе подписи обрезаются в кашу */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <Stat
            label={`${kk.srTek1} · ${breakdown.itemsRk1}`}
            value={breakdown.srTek1}
          />
          <Stat
            label={`${kk.srTek2} · ${breakdown.itemsRk2}`}
            value={breakdown.srTek2}
          />
          <Stat label={kk.rk1} value={breakdown.rk1} />
          <Stat label={kk.rk2} value={breakdown.rk2} />
          <Stat label={kk.rating} value={breakdown.rating} />
          <Stat label={kk.examGrade} value={breakdown.exam} />
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            {kk.canvasTotal}:{" "}
            <span className="font-semibold text-foreground/80">
              {breakdown.canvasScore !== null
                ? `${breakdown.canvasScore}%`
                : "—"}
            </span>
          </span>
          <button
            onClick={onOpen}
            className="font-medium text-primary hover:underline"
          >
            {kk.marksDetail}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

/** Imported Platonus journal history (courses 1-2), grouped by study year.
 *  Every year gets a course badge; the active course's year is expanded by default.
 *  Subject rows open the detail modal (итоги + оценки по дням) — как у Canvas-карточек.
 *  Empty → hint to run the Platonus import from the extension. */
function PlatonusHistory({
  records,
  activeCourse,
}: {
  records: PlatonusYearRecord[]
  activeCourse: number
}) {
  const defaultYear = 2023 + activeCourse
  const [openYear, setOpenYear] = useState<number | null>(
    records.some((r) => r.year === defaultYear) ? defaultYear : null
  )
  const [openSubject, setOpenSubject] = useState<PlatonusSubject | null>(null)

  if (records.length === 0) {
    return (
      <section className="space-y-2 border-t border-border/60 pt-2">
        <h2 className="text-sm font-semibold tracking-tight">
          {kk.platonusHistory}
        </h2>
        <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {kk.platonusEmptyHint}
        </p>
      </section>
    )
  }

  const years = [...new Set(records.map((r) => r.year))].sort((a, b) => b - a)

  return (
    <section className="min-w-0 space-y-3 border-t border-border/60 pt-2">
      <h2 className="text-sm font-semibold tracking-tight">
        {kk.platonusHistory}
      </h2>
      {years.map((year) => {
        const yearRecords = records
          .filter((r) => r.year === year)
          .sort((a, b) => a.term - b.term)
        const isOpen = openYear === year
        return (
          <div
            key={year}
            className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card"
          >
            <button
              onClick={() => setOpenYear(isOpen ? null : year)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted/40"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{kk.academicYearOf(year)}</span>
                <Badge
                  variant={year - 2023 === activeCourse ? "blue" : "outline"}
                  className="shrink-0 px-1.5 py-0 text-[10px]"
                >
                  {kk.courseNumber(year - 2023)}
                </Badge>
              </span>
              <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                {yearRecords.reduce((sum, r) => sum + r.subjects.length, 0)}{" "}
                {kk.subjects.toLowerCase()}
              </span>
            </button>
            {isOpen &&
              yearRecords.map((record) => (
                <div
                  key={record.id}
                  className="min-w-0 border-t border-border/50 px-4 py-3"
                >
                  <p className="mb-2 truncate text-xs font-semibold text-muted-foreground">
                    {record.term > 0
                      ? kk.termN(record.term)
                      : `${kk.extraTerm} ${-record.term}`}{" "}
                    · {record.syncedAt.slice(0, 10)}
                  </p>
                  <div className="grid min-w-0 grid-cols-1 gap-1.5 md:grid-cols-2">
                    {record.subjects.map((s) => (
                      <button
                        key={s.code + s.name}
                        onClick={() => setOpenSubject(s)}
                        className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/60"
                      >
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={`${s.name} · ${s.teacher ?? ""}`}
                        >
                          <span className="font-medium">{s.name}</span>
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                          {kk.ratingShort}{" "}
                          {s.rating !== null ? s.rating.toFixed(1) : "—"} ·{" "}
                          {kk.examShort}{" "}
                          {s.exam !== null ? s.exam.toFixed(0) : "—"}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                            s.final !== null
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground"
                          )}
                        >
                          {s.final !== null ? `${s.final.toFixed(0)}%` : "—"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )
      })}
      <p className="text-[10px] text-muted-foreground">
        {kk.platonusHistoryHint}
      </p>

      {openSubject && (
        <Modal
          isOpen
          onClose={() => setOpenSubject(null)}
          title={openSubject.name}
          description={`${openSubject.code}${openSubject.teacher ? " · " + openSubject.teacher : ""}`}
          className="max-w-3xl"
        >
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <Donut value={openSubject.final} />
              <div className="grid flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3">
                <Stat label={kk.srTek1} value={openSubject.srTek1} />
                <Stat label={kk.srTek2} value={openSubject.srTek2} />
                <Stat label={kk.rk1} value={openSubject.rk1} />
                <Stat label={kk.rk2} value={openSubject.rk2} />
                <Stat label={kk.rating} value={openSubject.rating} />
                <Stat label={kk.examGrade} value={openSubject.exam} />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {kk.platonusMarksTitle}
              </p>
              <PlatonusMarksDetail marks={openSubject.marks} />
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

export function GradesPage() {
  const {
    loading,
    canvasCourses,
    canvasAssignments,
    canvasCourseMap,
    canvasPeriod,
    subjects,
    calendar,
    activeCourse,
    activeSemester,
    platonusYears,
  } = useAristosDB()
  const [openCourseId, setOpenCourseId] = useState<number | null>(null)

  const semester = useMemo(
    () => calendar?.semesters?.find((s) => s.semester === activeSemester),
    [calendar, activeSemester]
  )

  // Only courses that belong to the active course/semester (via mapping) or unmapped ones.
  const visibleCourses = useMemo(() => {
    return canvasCourses.filter((course) => {
      const subjectId = canvasCourseMap[String(course.id)]
      if (!subjectId) return true
      const subject = subjects.find((s) => s.subject_id === subjectId)
      return (
        !subject ||
        (subject.course === activeCourse && subject.semester === activeSemester)
      )
    })
  }, [canvasCourses, canvasCourseMap, subjects, activeCourse, activeSemester])

  const rows = useMemo(
    () =>
      visibleCourses.map((course) => ({
        course,
        breakdown: computeCourseGrades(course, canvasAssignments, semester),
      })),
    [visibleCourses, canvasAssignments, semester]
  )

  // Canvas data belongs to the period it was synced in (or to mapped subjects of
  // the active course). Legacy syncs without canvasPeriod stay always-visible.
  const canvasVisible = useMemo(() => {
    if (!canvasPeriod) return true
    if (
      canvasPeriod.course === activeCourse &&
      canvasPeriod.semester === activeSemester
    )
      return true
    return visibleCourses.some((course) => {
      const subjectId = canvasCourseMap[String(course.id)]
      const subject = subjectId
        ? subjects.find((s) => s.subject_id === subjectId)
        : undefined
      return (
        subject?.course === activeCourse && subject?.semester === activeSemester
      )
    })
  }, [
    canvasPeriod,
    activeCourse,
    activeSemester,
    visibleCourses,
    canvasCourseMap,
    subjects,
  ])

  // Platonus history is scoped by study year: 2024 = 1st course, 2025 = 2nd, 2026 = 3rd.
  const platonusForCourse = useMemo(
    () =>
      platonusYears
        .filter((record) => record.year - 2023 === activeCourse)
        .sort((a, b) => a.term - b.term),
    [platonusYears, activeCourse]
  )

  const openCourse =
    openCourseId !== null
      ? canvasCourses.find((c) => c.id === openCourseId)
      : undefined
  const openBreakdown =
    openCourseId !== null
      ? computeCourseGrades(
          openCourse ?? canvasCourses[0],
          canvasAssignments,
          semester
        )
      : null
  const gpaReady = rows.filter((r) => r.breakdown.final !== null)

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-full min-w-0 space-y-6">
      <header className="mb-2 min-w-0">
        <p className="text-sm font-medium text-primary">Canvas · yu.edu.kz</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {kk.gradesTitle}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {kk.gradesSubtitle}
        </p>
      </header>

      {canvasCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 p-10 text-center">
          <p className="text-sm font-medium">{kk.canvasEmptyTitle}</p>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
            {kk.canvasEmptyDesc}
          </p>
        </div>
      ) : (
        <>
          {!canvasVisible && platonusForCourse.length === 0 && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              {kk.gradesNoCoursesForSemester}
            </p>
          )}
          {canvasVisible && (
            <>
              {semester && (
                <p className="text-xs text-muted-foreground">
                  {semester.semester_start} — {semester.semester_end} · {kk.rk1}{" "}
                  ≤ {semester.midterm_controls?.[0]?.end ?? "—"}
                </p>
              )}
              <Suspense
                fallback={
                  <div className="h-40 animate-pulse rounded-xl bg-muted/30" />
                }
              >
                <GradeCharts
                  courses={visibleCourses}
                  assignments={canvasAssignments}
                />
              </Suspense>
            </>
          )}
          {canvasVisible && rows.length === 0 ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              {kk.gradesNoCoursesForSemester}
            </p>
          ) : canvasVisible ? (
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map(({ course, breakdown }) => (
                <CourseGradeCard
                  key={course.id}
                  course={course}
                  breakdown={breakdown}
                  onOpen={() => setOpenCourseId(course.id)}
                />
              ))}
            </div>
          ) : null}
          {canvasVisible && gpaReady.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {kk.finalComputed.replace("{n}", String(gpaReady.length))}
            </p>
          )}
          <PlatonusHistory
            records={platonusYears}
            activeCourse={activeCourse}
          />
        </>
      )}

      {openCourse && openBreakdown && (
        <Modal
          isOpen
          onClose={() => setOpenCourseId(null)}
          title={openCourse.name}
          description={`${openCourse.code} · ${kk.finalComputedShort}: ${openBreakdown.final !== null ? `${openBreakdown.final}%` : "—"}`}
          className="max-w-xl"
        >
          <MarksDetail courseId={openCourse.id} />
        </Modal>
      )}
    </div>
  )
}
