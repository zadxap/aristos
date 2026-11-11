import { GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { scoreBadgeVariant } from '@/lib/score-tone'
import type { AdmissionRatingSource } from '@/lib/grade-scheme'
import { kk } from '@/i18n'
import type { CanvasCourse } from '@/types'

const SCORE_TEXT: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  blue: 'text-blue-600 dark:text-blue-400',
  amber: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
  outline: 'text-muted-foreground',
}

/**
 * Canvas courses with their current overall score.
 * Horizontal strip (mobile) or vertical stack (desktop rail); doubles as a
 * course filter for the deadline list (click to toggle).
 *
 * Итог по приоритету courseAdmissionRating(): Canvas-итог → официальный
 * «Рейтинг» из Платонуса (вуз передаёт РК из LTI-тулзы в Платонус) →
 * «≈рейтинг», вычисленный из тапсырм.
 */
export function CanvasGradesStrip({
  courses,
  gradedCounts,
  selected,
  onSelect,
  ratings,
  variant = 'horizontal',
}: {
  courses: CanvasCourse[]
  gradedCounts: Map<number, number>
  selected: number | 'all'
  onSelect: (courseId: number | 'all') => void
  ratings?: Map<number, { value: number | null; source: AdmissionRatingSource }>
  variant?: 'horizontal' | 'vertical'
}) {
  if (courses.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{kk.canvasGrades}</h2>
        {selected !== 'all' && (
          <button
            onClick={() => onSelect('all')}
            className="text-xs font-medium text-primary hover:underline"
          >
            {kk.canvasAllCourses}
          </button>
        )}
      </div>
      <div
        className={cn(
          '-mx-1 px-1 pb-1',
          variant === 'horizontal' ? 'no-scrollbar flex gap-2 overflow-x-auto' : 'flex flex-col gap-2'
        )}
      >
        {courses.map((course) => {
          const entry = ratings?.get(course.id)
          const value = course.current_score ?? entry?.value ?? null
          const isComputed = course.current_score === null && entry?.source === 'computed' && value !== null
          const fromPlatonus = course.current_score === null && entry?.source === 'platonus' && value !== null
          const tone = scoreBadgeVariant(value)
          const isSelected = selected === course.id
          const graded = gradedCounts.get(course.id) ?? 0
          return (
            <button
              key={course.id}
              onClick={() => onSelect(isSelected ? 'all' : course.id)}
              className={cn(
                'shrink-0 rounded-xl border bg-card p-3 text-left shadow-xs transition-all hover:border-primary/40',
                variant === 'horizontal' ? 'w-44' : 'w-full',
                isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border/70'
              )}
              title={course.name}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-semibold text-muted-foreground">{course.code}</span>
                <GraduationCap className={cn('size-3.5 shrink-0', SCORE_TEXT[tone])} />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span
                  className={cn('text-lg font-bold tabular-nums', isComputed && 'italic', SCORE_TEXT[tone])}
                  title={
                    isComputed
                      ? kk.canvasComputedScoreHint
                      : fromPlatonus
                        ? kk.canvasPlatonusScoreHint
                        : undefined
                  }
                >
                  {value !== null ? `${isComputed ? '≈' : ''}${value}%` : '—'}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground truncate">
                {graded > 0 ? `${kk.statusGraded}: ${graded}` : course.name}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
