import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { kk } from '@/i18n'
import { useAristosDB } from '@/context/DBContext'

function formatShort(iso: string): string {
  const date = new Date(iso)
  const day = date.getDate()
  const month = kk.months[date.getMonth()]
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const today = new Date()
  const isToday = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
  return isToday ? `${hours}:${minutes}` : `${day} ${month}`
}

/** Compact "next deadlines" card on the home page. Hidden until a Canvas sync exists. */
export function UpcomingDeadlines() {
  const { canvasAssignments, canvasCourses, canvasCourseMap, subjects } = useAristosDB()
  const upcoming = useMemo(() => {
    const now = new Date().getTime()
    return canvasAssignments
      .filter((item) => item.due_at && new Date(item.due_at).getTime() >= now && !item.graded)
      .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
      .slice(0, 4)
  }, [canvasAssignments])

  if (upcoming.length === 0) return null

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight">{kk.upcomingDeadlines}</h3>
        </div>
        <Link
          to="/deadlines"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {kk.viewAll}
          <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="space-y-1.5">
        {upcoming.map((item) => {
          const subjectId = canvasCourseMap[String(item.course_id)] ?? null
          const subject = subjectId ? subjects.find((s) => s.subject_id === subjectId) : undefined
          const courseLabel = subject?.subject_name ?? canvasCourses.find((c) => c.id === item.course_id)?.name ?? kk.itemTypes[item.type]
          return (
            <a
              key={item.id}
              href={item.html_url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="shrink-0 w-20 text-xs font-semibold text-primary tabular-nums">
                  {formatShort(item.due_at!)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
              </div>
              <p className="mt-0.5 ml-20 truncate text-[10px] text-muted-foreground">{courseLabel}</p>
            </a>
          )
        })}
      </div>
    </div>
  )
}
