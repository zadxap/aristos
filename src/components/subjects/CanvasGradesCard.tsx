import { Link } from 'react-router-dom'
import { ArrowRight, GraduationCap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { kk } from '@/i18n'
import { useAristosDB } from '@/context/DBContext'
import { scoreBadgeVariant } from '@/lib/score-tone'
import { cn } from '@/lib/utils'
import type { Subject } from '@/types'

const TONE_TEXT: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  blue: 'text-blue-600 dark:text-blue-400',
  amber: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
  outline: 'text-muted-foreground',
}

/** Canvas overall score + recent graded work for the subject's mapped course. */
export function CanvasGradesCard({ subject }: { subject: Subject }) {
  const { canvasCourses, canvasAssignments, canvasCourseMap } = useAristosDB()

  const mappedEntry = Object.entries(canvasCourseMap).find(([, subjectId]) => subjectId === subject.subject_id)
  if (!mappedEntry) return null
  const courseId = Number(mappedEntry[0])
  const course = canvasCourses.find((c) => c.id === courseId)
  if (!course) return null

  const graded = canvasAssignments
    .filter((item) => item.course_id === courseId && item.graded)
    .sort((a, b) => (b.submitted_at ?? b.due_at ?? '').localeCompare(a.submitted_at ?? a.due_at ?? ''))
    .slice(0, 5)

  const tone = scoreBadgeVariant(course.current_score)

  return (
    <Card className="border-border/80 shadow-xs">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight">{kk.canvasGrades}</h2>
          <Badge variant="blue" className="text-[10px] px-1.5 py-0">{course.code}</Badge>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl bg-card border border-border/60', TONE_TEXT[tone])}>
            <GraduationCap className="size-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">{kk.currentScore}</p>
            <p className={cn('text-xl font-bold tabular-nums leading-tight', TONE_TEXT[tone])}>
              {course.current_score !== null ? `${course.current_score}%` : '—'}
              {course.current_grade && (
                <span className="ml-1.5 text-sm font-medium">{course.current_grade}</span>
              )}
            </p>
          </div>
        </div>

        {graded.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {kk.canvasRecentGraded}
            </p>
            {graded.map((item) => (
              <a
                key={item.id}
                href={item.html_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                {item.late && (
                  <Badge variant="amber" className="text-[10px] px-1.5 py-0">{kk.statusLate}</Badge>
                )}
                <span className="shrink-0 font-semibold tabular-nums text-foreground/80">
                  {item.score ?? '—'} / {item.points_possible}
                </span>
              </a>
            ))}
          </div>
        )}

        <Link
          to="/deadlines"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {kk.deadlines}
          <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  )
}
