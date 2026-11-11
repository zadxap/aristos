import { useMemo, useState } from 'react'
import { CalendarClock, ExternalLink, Link2, Settings2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CourseMappingModal } from '@/components/deadlines/CourseMappingModal'
import { CanvasGradesStrip } from '@/components/deadlines/CanvasGradesStrip'
import { kk } from '@/i18n'
import { effectiveDeadline } from '@/lib/canvas'
import { courseAdmissionRating } from '@/lib/grade-scheme'
import { useAristosDB } from '@/context/DBContext'
import type { CanvasAssignment, CanvasCourse } from '@/types'

function formatDueDate(iso: string): string {
  const date = new Date(iso)
  const day = date.getDate()
  const month = kk.months[date.getMonth()]
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day} ${month}, ${hours}:${minutes}`
}

function DueCard({ item, course }: { item: CanvasAssignment; course?: CanvasCourse }) {
  const { canvasCourseMap, subjects } = useAristosDB()

  const subjectId = canvasCourseMap[String(item.course_id)] ?? null
  const subject = subjectId ? subjects.find((s) => s.subject_id === subjectId) : undefined
  // Срок, а без него «Доступно до» (lock_at) — карточка дедлайна обязана
  // показывать и просрочивать по нему
  const due = effectiveDeadline(item)

  const status: 'missing' | 'late' | 'graded' | 'submitted' | 'open' = item.missing
    ? 'missing'
    : item.late
      ? 'late'
      : item.graded
        ? 'graded'
        : item.submitted_at
          ? 'submitted'
          : 'open'

  const accentClass = {
    missing: 'bg-rose-500',
    late: 'bg-amber-500',
    graded: 'bg-emerald-500',
    submitted: 'bg-blue-500',
    open: due && new Date(due) < new Date() ? 'bg-rose-500' : 'bg-border',
  }[status]

  return (
    <div className="relative flex items-start gap-3 rounded-xl border border-border/70 bg-card p-3.5 shadow-xs overflow-hidden">
      <span className={`absolute inset-y-0 left-0 w-1 ${accentClass}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 pl-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="purple" className="text-[10px] px-1.5 py-0">
            {kk.itemTypes[item.type]}
          </Badge>
          {course && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {course.code}
            </span>
          )}
          <span className="text-xs text-muted-foreground truncate max-w-[220px] sm:max-w-[320px]" title={subject?.subject_name ?? course?.name}>
            {subject?.subject_name ?? course?.name ?? kk.courseNo(item.course_id)}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium leading-snug">{item.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
            <CalendarClock className="size-3.5" />
            {due ? formatDueDate(due) : '—'}
          </span>
          {item.points_possible > 0 && (
            <span>{item.points_possible} {kk.points}</span>
          )}
          {item.graded && item.score !== null && (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {item.score} / {item.points_possible}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {status === 'missing' && <Badge variant="rose" className="text-[10px] px-1.5 py-0">{kk.statusMissing}</Badge>}
          {status === 'late' && <Badge variant="amber" className="text-[10px] px-1.5 py-0">{kk.statusLate}</Badge>}
          {status === 'graded' && <Badge variant="emerald" className="text-[10px] px-1.5 py-0">{kk.statusGraded}</Badge>}
          {status === 'submitted' && <Badge variant="blue" className="text-[10px] px-1.5 py-0">{kk.statusSubmitted}</Badge>}
          {status === 'open' && due && new Date(due) < new Date() && (
            <Badge variant="rose" className="text-[10px] px-1.5 py-0">{kk.overdue}</Badge>
          )}
        </div>
      </div>
      <a
        href={item.html_url}
        target="_blank"
        rel="noreferrer"
        title={kk.openInCanvas}
        className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
      >
        <ExternalLink className="size-4" />
      </a>
    </div>
  )
}

const INITIAL_VISIBLE = 3

/** Section with a "show more" reveal so huge lists don't bury the page. */
function CollapsibleSection({
  title,
  items,
  renderItem,
}: {
  title: string
  items: CanvasAssignment[]
  renderItem: (item: CanvasAssignment) => React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null
  const visible = expanded ? items : items.slice(0, INITIAL_VISIBLE)
  const hidden = items.length - visible.length

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-2">{visible.map(renderItem)}</div>
      {hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {kk.showMore} ({hidden})
        </button>
      )}
      {expanded && hidden === 0 && items.length > INITIAL_VISIBLE && (
        <button
          onClick={() => setExpanded(false)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          {kk.showLess}
        </button>
      )}
    </section>
  )
}

export function DeadlinesPage() {
  const {
    loading,
    canvasCourses,
    canvasAssignments,
    canvasLastSync,
    calendar,
    activeSemester,
    platonusYears,
  } = useAristosDB()
  const [mappingOpen, setMappingOpen] = useState(false)
  const [courseFilter, setCourseFilter] = useState<number | 'all'>('all')

  const coursesById = useMemo(
    () => new Map(canvasCourses.map((course) => [course.id, course])),
    [canvasCourses]
  )

  // Рейтинг допуска курса: Canvas-итог → официальный «Рейтинг» из Платонуса
  // (вуз передаёт РК из LTI-тулзы в Платонус) → вычисленный из тапсырм
  const semester = useMemo(
    () => calendar?.semesters?.find((s) => s.semester === activeSemester),
    [calendar, activeSemester]
  )
  const courseRatings = useMemo(() => {
    const map = new Map<number, { value: number | null; source: 'canvas' | 'platonus' | 'computed' }>()
    for (const course of canvasCourses) {
      map.set(course.id, courseAdmissionRating(course, canvasAssignments, platonusYears, semester))
    }
    return map
  }, [canvasCourses, canvasAssignments, platonusYears, semester])

  const gradedCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const item of canvasAssignments) {
      if (!item.graded) continue
      counts.set(item.course_id, (counts.get(item.course_id) ?? 0) + 1)
    }
    return counts
  }, [canvasAssignments])

  const groups = useMemo(() => {
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endToday = new Date(startToday.getTime() + 24 * 60 * 60 * 1000)
    const endWeek = new Date(startToday.getTime() + 7 * 24 * 60 * 60 * 1000)
    const cutoff = new Date(startToday.getTime() - 30 * 24 * 60 * 60 * 1000)

    const visible = courseFilter === 'all' ? canvasAssignments : canvasAssignments.filter((item) => item.course_id === courseFilter)
    // Оценённые работы — отдельный архив: временные секции только для живых дел
    const buckets: Record<'overdue' | 'today' | 'week' | 'later' | 'none' | 'graded', CanvasAssignment[]> = {
      overdue: [], today: [], week: [], later: [], none: [], graded: [],
    }

    for (const item of visible) {
      if (item.graded) {
        buckets.graded.push(item)
        continue
      }
      const dueIso = effectiveDeadline(item)
      if (!dueIso) {
        buckets.none.push(item)
        continue
      }
      const due = new Date(dueIso)
      if (due < startToday) {
        // Drop ancient items unless they still lack a grade.
        if (due >= cutoff || (!item.graded && !item.submitted_at)) buckets.overdue.push(item)
      } else if (due < endToday) buckets.today.push(item)
      else if (due < endWeek) buckets.week.push(item)
      else buckets.later.push(item)
    }

    const byDueAsc = (a: CanvasAssignment, b: CanvasAssignment) =>
      (effectiveDeadline(a) ?? '9999').localeCompare(effectiveDeadline(b) ?? '9999')
    for (const list of Object.values(buckets)) list.sort(byDueAsc)
    // Оценённые — свежие сверху
    buckets.graded.sort((a, b) => (effectiveDeadline(b) ?? '').localeCompare(effectiveDeadline(a) ?? ''))
    return buckets
  }, [canvasAssignments, courseFilter])

  const total = canvasAssignments.length
  const lastSyncText = canvasLastSync
    ? `${kk.canvasLastSync}: ${new Date(canvasLastSync).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    : kk.canvasNeverSynced

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Canvas · yu.edu.kz</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">{kk.deadlines}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {kk.deadlinesSubtitle} · {lastSyncText}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setMappingOpen(true)} className="gap-2">
          <Settings2 className="size-3.5 text-primary" />
          {kk.canvasMapping}
        </Button>
      </header>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 p-10 text-center">
          <Link2 className="size-8 text-muted-foreground/60 mb-3" />
          <p className="text-sm font-medium">{kk.canvasEmptyTitle}</p>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">{kk.canvasEmptyDesc}</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="min-w-0 space-y-6">
            {/* Mobile: horizontal grades strip; desktop shows it in the side rail */}
            <div className="lg:hidden">
              <CanvasGradesStrip
                courses={canvasCourses}
                gradedCounts={gradedCounts}
                selected={courseFilter}
                onSelect={setCourseFilter}
                ratings={courseRatings}
              />
            </div>

            {/* Фильтр по курсу — явные чипы, не только полоска оценок сбоку */}
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1 -my-1">
              <button
                onClick={() => setCourseFilter('all')}
                className={
                  'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                  (courseFilter === 'all'
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border/70 text-muted-foreground hover:text-foreground')
                }
              >
                {kk.allCourses}
              </button>
              {canvasCourses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => setCourseFilter(course.id)}
                  title={course.name}
                  className={
                    'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                    (courseFilter === course.id
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border/70 text-muted-foreground hover:text-foreground')
                  }
                >
                  {course.code}
                </button>
              ))}
            </div>

            {/* Upcoming first; overdue and no-date pushed to the bottom */}
            <CollapsibleSection
              title={kk.dueToday}
              items={groups.today}
              renderItem={(item) => <DueCard key={item.id} item={item} course={coursesById.get(item.course_id)} />}
            />
            <CollapsibleSection
              title={kk.dueThisWeek}
              items={groups.week}
              renderItem={(item) => <DueCard key={item.id} item={item} course={coursesById.get(item.course_id)} />}
            />
            <CollapsibleSection
              title={kk.dueLater}
              items={groups.later}
              renderItem={(item) => <DueCard key={item.id} item={item} course={coursesById.get(item.course_id)} />}
            />
            <CollapsibleSection
              title={kk.overdue}
              items={groups.overdue}
              renderItem={(item) => <DueCard key={item.id} item={item} course={coursesById.get(item.course_id)} />}
            />
            <CollapsibleSection
              title={kk.noDueDate}
              items={groups.none}
              renderItem={(item) => <DueCard key={item.id} item={item} course={coursesById.get(item.course_id)} />}
            />
            {/* Оценённые — отдельный архив, не мешают живым дедлайнам */}
            <CollapsibleSection
              title={kk.sectionGraded}
              items={groups.graded}
              renderItem={(item) => <DueCard key={item.id} item={item} course={coursesById.get(item.course_id)} />}
            />
          </div>

          <aside className="hidden lg:sticky lg:top-20 lg:block">
            <CanvasGradesStrip
              variant="vertical"
              courses={canvasCourses}
              gradedCounts={gradedCounts}
              selected={courseFilter}
              onSelect={setCourseFilter}
              ratings={courseRatings}
            />
          </aside>        </div>
      )}

      <CourseMappingModal isOpen={mappingOpen} onClose={() => setMappingOpen(false)} />
    </div>
  )
}
