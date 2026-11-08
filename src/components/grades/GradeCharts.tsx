import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { kk } from '@/i18n'
import type { CanvasAssignment, CanvasCourse } from '@/types'

const ACCENT = '#3b82f6'
const MUTED = '#94a3b8'
const STATUS_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#475569']

// Тултип в палитре сайта: без явного цвета recharts красит текст в #666 —
// на тёмной карточке он читается как чёрный.
const TOOLTIP_STYLE = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--card-foreground)',
} as const

/** «Название (КОД)» → «Название» — для подписей на диаграмме. */
function shortName(course: CanvasCourse): string {
  const stripped = course.name.replace(/\s*\([^()]+\)\s*$/, '').trim()
  return stripped || course.code
}

/** Перенос подписи по словам: до 3 строк по 22 символа, хвост с «…». */
function wrapLabel(text: string, max = 22, maxLines = 3): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) {
      current = word
    } else if ((current + ' ' + word).length <= max) {
      current += ' ' + word
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  if (lines.length <= maxLines) return lines
  const tail = lines.slice(maxLines - 1).join(' ')
  return [...lines.slice(0, maxLines - 1), tail.length > max ? tail.slice(0, max - 1) + '…' : tail]
}

interface TickProps {
  x?: number
  y?: number
  payload?: { value?: string }
}

/** Многострочный тик Y-оси: полное название в 2–3 строках вместо «…». */
function WrappedTick({ x, y, payload }: TickProps) {
  const lines = wrapLabel(String(payload?.value ?? ''))
  const lineHeight = 12
  const startY = (y ?? 0) - ((lines.length - 1) * lineHeight) / 2 + 3.5
  return (
    <text x={x} y={startY} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

/** Рейтинг по курсам (60/40 scheme), sorted best first */
function RatingBars({ rows }: { rows: { name: string; rating: number | null; canvasScore: number | null }[] }) {
  const data = rows
    .map((r) => ({ name: r.name, value: r.rating ?? r.canvasScore ?? 0, hasRating: r.rating !== null }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  return (
    <Card className="border-border/80 shadow-xs min-w-0 overflow-hidden">
      <CardContent className="p-4 min-w-0">
        <h3 className="mb-3 text-sm font-semibold tracking-tight">{kk.chartRatingTitle}</h3>
        <div className="w-full min-w-0 overflow-hidden" style={{ height: Math.max(120, data.length * 38) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="name" width={150} tick={<WrappedTick />} axisLine={false} tickLine={false} interval={0} />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: 'var(--card-foreground)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--card-foreground)' }}
                formatter={(value) => [`${Number(value).toFixed(2)}%`, kk.rating]}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={i === 0 ? ACCENT : entry.hasRating ? '#60a5fa' : MUTED} opacity={i === 0 ? 1 : 0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">{kk.chartRatingHint}</p>
      </CardContent>
    </Card>
  )
}

/** Assignment status distribution for the active semester's courses */
function StatusDonut({ assignments }: { assignments: CanvasAssignment[] }) {
  const graded = assignments.filter((a) => a.graded).length
  const submitted = assignments.filter((a) => !a.graded && a.submitted_at).length
  const missing = assignments.filter((a) => a.missing && !a.graded).length
  const ungraded = assignments.filter((a) => !a.graded && !a.submitted_at && !a.missing).length

  const data = [
    { name: kk.statusGraded, value: graded },
    { name: kk.statusSubmitted, value: submitted },
    { name: kk.statusLate, value: assignments.filter((a) => a.late && a.graded).length },
    { name: kk.statusMissing, value: missing },
    { name: kk.chartUngraded, value: ungraded },
  ].filter((d) => d.value > 0)

  const total = assignments.length

  return (
    <Card className="border-border/80 shadow-xs min-w-0 overflow-hidden">
      <CardContent className="p-4 min-w-0">
        <h3 className="mb-1 text-sm font-semibold tracking-tight">{kk.chartStatusTitle}</h3>
        <p className="mb-2 text-[10px] text-muted-foreground">{total} {kk.points}</p>
        <div className="w-full min-w-0 overflow-hidden" style={{ height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
                {data.map((_, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: 'var(--card-foreground)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--card-foreground)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
          {data.map((d, i) => (
            <span key={d.name} className="flex items-center gap-1.5 text-muted-foreground min-w-0">
              <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: STATUS_COLORS[i % STATUS_COLORS.length] }} />
              <span className="truncate">{d.name}: <span className="font-semibold text-foreground">{d.value}</span></span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function GradeCharts({ courses, assignments }: { courses: CanvasCourse[]; assignments: CanvasAssignment[] }) {
  const rows = courses.map((c) => {
    const courseAssignments = assignments.filter((a) => a.course_id === c.id)
    const graded = courseAssignments.filter((a) => a.graded || a.missing)
    const pct = graded.map((a) => (a.score !== null && a.points_possible > 0 ? (a.score / a.points_possible) * 100 : 0))
    const rating = pct.length ? Math.round((pct.reduce((s, v) => s + v, 0) / pct.length) * 100) / 100 : null
    return { name: shortName(c), rating, canvasScore: c.current_score }
  })

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px] min-w-0">
      <RatingBars rows={rows} />
      <StatusDonut assignments={assignments} />
    </div>
  )
}
