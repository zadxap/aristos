import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { kk } from '@/i18n'
import { cn } from '@/lib/utils'
import type { GpaResult } from './gpa-scale'

function formatGpa(value: number | null): string {
  return value === null ? '—' : value.toFixed(2)
}

function Delta({ diff }: { diff: number | null }) {
  if (diff === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <ArrowRight className="size-3.5" />
        —
      </span>
    )
  }
  const rising = diff > 0.005
  const falling = diff < -0.005
  const Icon = rising ? ArrowUpRight : falling ? ArrowDownRight : ArrowRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums',
        rising && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        falling && 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
        !rising && !falling && 'bg-muted text-muted-foreground'
      )}
    >
      <Icon className="size-3.5" />
      {diff >= 0 ? '+' : ''}
      {diff.toFixed(2)}
    </span>
  )
}

/** Крупный блок: текущий GPA → прогноз GPA, разница стрелкой. */
export function GpaSummary({ current, projected }: { current: GpaResult; projected: GpaResult }) {
  const diff =
    current.gpa !== null && projected.gpa !== null ? Math.round((projected.gpa - current.gpa) * 100) / 100 : null

  return (
    <Card className="border-border/80 shadow-xs">
      <CardContent className="p-5">
        <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{kk.gpaCurrent}</p>
            <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">{formatGpa(current.gpa)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {kk.gpaCreditsCounted(current.creditsUsed, current.creditsTotal)}
            </p>
          </div>
          <div className="justify-self-start sm:justify-self-center">
            <Delta diff={diff} />
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{kk.gpaProjected}</p>
            <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">{formatGpa(projected.gpa)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {kk.gpaCreditsCounted(projected.creditsUsed, projected.creditsTotal)}
            </p>
          </div>
        </div>
        <p className="mt-4 border-t border-border/60 pt-3 text-[11px] leading-relaxed text-muted-foreground">
          {kk.gpaFormulaNote}
        </p>
      </CardContent>
    </Card>
  )
}
