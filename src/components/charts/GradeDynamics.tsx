import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { kk } from '@/i18n'
import type { CanvasAssignment } from '@/types'
import { AXIS_TICK, CHART_COLORS, GRID_STROKE, TOOLTIP_ITEM_STYLE } from './chart-theme'

interface DynamicsPoint {
  /** dd.MM of the sort date */
  label: string
  title: string
  /** percent of this single work */
  percent: number
  /** cumulative average across all courses so far */
  avg: number
  /** graded works so far (1-based) */
  count: number
}

interface GradedEntry {
  item: CanvasAssignment
  date: string
  percent: number
}

function percentOf(item: CanvasAssignment): number | null {
  if (item.score !== null && item.points_possible > 0) return (item.score / item.points_possible) * 100
  if (item.missing) return 0 // пропущенный дедлайн считается нулём, как в Платонусе
  return null
}

function DynamicsTooltip({ active, payload }: TooltipContentProps) {
  if (!active || payload.length === 0) return null
  const point = payload[0].payload as DynamicsPoint
  return (
    <div
      className="px-3 py-2 shadow-xs"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        fontSize: 12,
      }}
    >
      <p className="max-w-[230px] truncate font-medium text-foreground">{point.title}</p>
      <p className="mt-1 text-muted-foreground" style={TOOLTIP_ITEM_STYLE}>
        {point.label} · {kk.chartWorkNo(point.count)}
      </p>
      <p className="tabular-nums">
        <span className="text-muted-foreground">{kk.chartForWork}</span>
        <span className="font-semibold text-foreground">{point.percent.toFixed(1)}%</span>
      </p>
      <p className="tabular-nums">
        <span className="text-muted-foreground">{kk.chartAverage}</span>
        <span className="font-semibold" style={{ color: CHART_COLORS.accent }}>
          {point.avg.toFixed(2)}%
        </span>
      </p>
    </div>
  )
}

/** Cumulative average grade: graded works sorted by (submitted_at ?? due_at), all courses together. */
export function GradeDynamics({ assignments }: { assignments: CanvasAssignment[] }) {
  const data = useMemo<DynamicsPoint[]>(() => {
    const graded = assignments
      .map((item) => ({ item, date: item.submitted_at ?? item.due_at, percent: percentOf(item) }))
      .filter((entry): entry is GradedEntry => entry.date !== null && entry.percent !== null)
      .sort((a, b) => a.date.localeCompare(b.date) || a.item.id - b.item.id)

    const result: DynamicsPoint[] = []
    let runningSum = 0
    for (let index = 0; index < graded.length; index++) {
      runningSum += graded[index].percent
      const d = new Date(graded[index].date)
      result.push({
        label: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
        title: graded[index].item.title,
        percent: Math.round(graded[index].percent * 10) / 10,
        avg: Math.round((runningSum / (index + 1)) * 100) / 100,
        count: index + 1,
      })
    }
    return result
  }, [assignments])


  const last = data.length > 0 ? data[data.length - 1] : null

  return (
    <Card className="border-border/80 shadow-xs">
      <CardContent className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight">{kk.chartDynamicsTitle}</h3>
          {last && <span className="text-sm font-semibold tabular-nums text-foreground">{last.avg.toFixed(2)}%</span>}
        </div>
        <p className="mt-0.5 mb-3 text-[11px] text-muted-foreground">
          {data.length > 0
            ? kk.chartDynamicsHint(data.length)
            : kk.chartNoGraded}
        </p>
        {data.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 text-xs text-muted-foreground">
            {kk.chartNoGradedYet}
          </div>
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={28} />
                <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  content={DynamicsTooltip}
                  cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3', opacity: 0.5 }}
                />
                <Area
                  type="monotone"
                  dataKey="avg"
                  name={kk.chartAvgScore}
                  stroke={CHART_COLORS.accent}
                  strokeWidth={2}
                  fill={CHART_COLORS.accent}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
