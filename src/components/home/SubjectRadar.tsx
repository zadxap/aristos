import { useMemo } from "react"
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { kk } from "@/i18n"
import { useAristosDB } from "@/context/DBContext"
import { courseAdmissionRating } from "@/lib/grade-scheme"
import { cn } from "@/lib/utils"

/** Радар пәндер: ағымдағы балл 0–100 әр Canvas-курс бойынша.
 *  Маппинг «курс → пән» НЕ требуется. Балл — courseAdmissionRating, как везде:
 *  Canvas-итог → «Рейтинг» из журнала Платонуса → расчёт по тапсырмам.
 *  (Canvas больше не отдаёт current_score — вуз перенёс оценки в LTI-тул.) */
export function SubjectRadar({ className }: { className?: string }) {
  const { canvasCourses, canvasAssignments, platonusYears, calendar, activeSemester } =
    useAristosDB()

  const semester = useMemo(
    () => calendar?.semesters?.find((s) => s.semester === activeSemester),
    [calendar, activeSemester]
  )

  const data = useMemo(() => {
    return canvasCourses
      .map((course) => {
        const rating = courseAdmissionRating(
          course,
          canvasAssignments,
          platonusYears,
          semester
        )
        return rating.value !== null
          ? { code: course.code, name: course.name, value: rating.value }
          : null
      })
      .filter(
        (item): item is { code: string; name: string; value: number } =>
          item !== null
      )
  }, [canvasCourses, canvasAssignments, platonusYears, semester])

  return (
    <Card
      className={cn(
        "h-full overflow-hidden border-border/80 shadow-xs",
        className
      )}
    >
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight">
            {kk.radarTitle}
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {kk.radarHint}
          </span>
        </div>
        {data.length >= 3 ? (
          // высота задана ЧИСЛОМ, а не через родителя: иначе ResponsiveContainer
          // в PWA иногда меряет контейнер неправильно, и диаграмма растягивает
          // карточку на несколько экранов
          <ResponsiveContainer width="100%" height={272}>
            <RadarChart data={data} outerRadius="70%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis
                dataKey="code"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickFormatter={(code: string) =>
                  code.length > 14 ? `${code.slice(0, 13)}…` : code
                }
              />
              <PolarRadiusAxis
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                dataKey="value"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.25}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, ""]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.name ?? ""
                }
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-16 text-center text-xs text-muted-foreground">
            {kk.radarEmpty}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
