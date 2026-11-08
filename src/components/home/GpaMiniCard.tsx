import { useMemo } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Sigma } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { kk } from "@/i18n"
import { useAristosDB } from "@/context/DBContext"
import { computeGpa, DEFAULT_GPA_SCALE } from "@/components/gpa/gpa-scale"
import { deriveGpaRows } from "@/components/gpa/gpa-data"
import { loadGpaRows, loadGpaScale } from "@/components/gpa/gpa-storage"

/** Мини-блок GPA на главной: текущий и прогнозируемый балл + ссылка на калькулятор.
 *  Данные — те же, что и на странице GPA: ручные строки из localStorage,
 *  иначе авто-вывод из Платонуса/Canvas. */
export function GpaMiniCard() {
  const {
    subjects,
    activeCourse,
    activeSemester,
    platonusYears,
    canvasCourses,
    canvasCourseMap,
  } = useAristosDB()

  const rows = useMemo(
    () =>
      loadGpaRows() ??
      deriveGpaRows({
        subjects,
        activeCourse,
        activeSemester,
        platonusYears,
        canvasCourses,
        canvasCourseMap,
      }),
    [
      subjects,
      activeCourse,
      activeSemester,
      platonusYears,
      canvasCourses,
      canvasCourseMap,
    ]
  )
  const scale = useMemo(() => loadGpaScale() ?? DEFAULT_GPA_SCALE, [])
  const current = useMemo(
    () => computeGpa(rows, scale, "current"),
    [rows, scale]
  )
  const projected = useMemo(
    () => computeGpa(rows, scale, "projected"),
    [rows, scale]
  )

  return (
    <Card className="border-border/80 shadow-xs">
      <CardContent className="p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground">
            <Sigma className="size-4 text-primary" />
            GPA
          </h3>
          <Link
            to="/gpa"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            {kk.gpaMiniOpen}
            <ArrowRight className="size-3" />
          </Link>
        </div>

        {current.gpa === null && projected.gpa === null ? (
          <p className="py-2 text-xs leading-relaxed text-muted-foreground">
            {kk.gpaMiniEmpty}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-muted/40 px-3 py-2.5">
              <p className="text-[10px] leading-tight font-medium tracking-wide text-muted-foreground uppercase">
                {kk.gpaCurrent}
              </p>
              <p className="mt-1 text-xl font-bold text-foreground tabular-nums">
                {current.gpa !== null ? current.gpa.toFixed(2) : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-2.5">
              <p className="text-[10px] leading-tight font-medium tracking-wide text-muted-foreground uppercase">
                {kk.gpaProjected}
              </p>
              <p className="mt-1 text-xl font-bold text-primary tabular-nums">
                {projected.gpa !== null ? projected.gpa.toFixed(2) : "—"}
              </p>
            </div>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          {kk.gpaMiniCredits(current.creditsTotal)}
        </p>
      </CardContent>
    </Card>
  )
}
