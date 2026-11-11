import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { kk } from '@/i18n'
import { effectiveDeadline } from '@/lib/canvas'
import type { CanvasAssignment } from '@/types'
import {
  AXIS_TICK,
  CHART_COLORS,
  GRID_STROKE,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_CURSOR_STYLE,
  TOOLTIP_ITEM_STYLE,
} from './chart-theme'

const WEEKS_SHOWN = 6

export interface DeadlineWeekPoint {
  /** Monday of the ISO week, dd.MM */
  label: string
  /** "dd.MM – dd.MM" for the tooltip */
  range: string
  total: number
  submitted: number
}

/** ISO-8601 week number (weeks start on Monday) for a local date. */
function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7 // Sun = 7
  d.setUTCDate(d.getUTCDate() + 4 - day) // Thursday of the ISO week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

function mondayOfCurrentWeek(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDay(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}`
}

/** Assignments with due_at grouped by ISO week — the 6 weeks starting from the current one. */
export function DeadlineBars({ assignments }: { assignments: CanvasAssignment[] }) {
  const data = useMemo<DeadlineWeekPoint[]>(() => {
    const start = mondayOfCurrentWeek()
    const buckets = new Map<string, DeadlineWeekPoint>()
    for (let i = 0; i < WEEKS_SHOWN; i++) {
      const monday = addDays(start, i * 7)
      const sunday = addDays(monday, 6)
      const { year, week } = isoWeek(monday)
      buckets.set(`${year}-W${String(week).padStart(2, '0')}`, {
        label: formatDay(monday),
        range: `${formatDay(monday)} – ${formatDay(sunday)}`,
        total: 0,
        submitted: 0,
      })
    }
    for (const item of assignments) {
      const dueIso = effectiveDeadline(item)
      if (!dueIso) continue
      const { year, week } = isoWeek(new Date(dueIso))
      const bucket = buckets.get(`${year}-W${String(week).padStart(2, '0')}`)
      if (!bucket) continue
      bucket.total += 1
      if (item.submitted_at) bucket.submitted += 1
    }
    return [...buckets.values()]
  }, [assignments])

  const total = data.reduce((sum, week) => sum + week.total, 0)

  return (
    <Card className="border-border/80 shadow-xs">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold tracking-tight">{kk.chartDeadlinesByWeek}</h3>
        <p className="mt-0.5 mb-3 text-[11px] text-muted-foreground">
          {total > 0
            ? kk.chartDeadlinesHint(WEEKS_SHOWN, total)
            : kk.chartDeadlinesEmpty(WEEKS_SHOWN)}
        </p>
        {total === 0 ? (
          <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 text-xs text-muted-foreground">
            {kk.chartNoDueItems}
          </div>
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={data} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  cursor={TOOLTIP_CURSOR_STYLE}
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelFormatter={(_, payload) =>
                    payload[0] && payload[0].payload ? kk.chartWeekRange(payload[0].payload.range) : ''
                  }
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="total" name={kk.chartTotal} fill={CHART_COLORS.accent} radius={[5, 5, 0, 0]} barSize={16} />
                <Bar dataKey="submitted" name={kk.chartSubmitted} fill={CHART_COLORS.emerald} radius={[5, 5, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
