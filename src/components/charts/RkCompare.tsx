import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { kk } from '@/i18n'
import {
  AXIS_TICK,
  CHART_COLORS,
  GRID_STROKE,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_CURSOR_STYLE,
  TOOLTIP_ITEM_STYLE,
  shortenCode,
} from './chart-theme'

export interface RkCompareRow {
  code: string
  rk1: number | null
  rk2: number | null
}

/** РК1 vs РК2 by course — grouped bars; null periods just leave a gap. */
export function RkCompare({ data }: { data: RkCompareRow[] }) {
  const rows = data.filter((row) => row.rk1 !== null || row.rk2 !== null)

  return (
    <Card className="border-border/80 shadow-xs">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold tracking-tight">{kk.chartRkTitle}</h3>
        <p className="mt-0.5 mb-3 text-[11px] text-muted-foreground">{kk.chartRkHint}</p>
        {rows.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 text-xs text-muted-foreground">
            {kk.chartNoRkData}
          </div>
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} strokeDasharray="3 3" />
                <XAxis
                  dataKey="code"
                  tick={AXIS_TICK}
                  tickFormatter={(value: string) => shortenCode(value)}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                  height={34}
                />
                <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  cursor={TOOLTIP_CURSOR_STYLE}
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  formatter={(value) => `${Number(value).toFixed(1)}%`}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="rk1" name={kk.rk1} fill={CHART_COLORS.accent} radius={[5, 5, 0, 0]} barSize={14} />
                <Bar dataKey="rk2" name={kk.rk2} fill={CHART_COLORS.emerald} radius={[5, 5, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
