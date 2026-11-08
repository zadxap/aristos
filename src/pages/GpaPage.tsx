import { useEffect, useMemo, useState } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { kk } from "@/i18n"
import { useAristosDB } from "@/context/DBContext"
import { computeCourseGrades } from "@/lib/grade-scheme"
import { DeadlineBars } from "@/components/charts/DeadlineBars"
import { GradeDynamics } from "@/components/charts/GradeDynamics"
import { RkCompare } from "@/components/charts/RkCompare"
import { GpaRowsTable } from "@/components/gpa/GpaRowsTable"
import { GpaSummary } from "@/components/gpa/GpaSummary"
import { ScaleEditor } from "@/components/gpa/ScaleEditor"
import { TranscriptImport } from "@/components/gpa/TranscriptImport"
import { deriveGpaRows } from "@/components/gpa/gpa-data"
import {
  computeGpa,
  DEFAULT_GPA_SCALE,
  type GpaRow,
  type GpaScaleTier,
} from "@/components/gpa/gpa-scale"
import {
  loadGpaRows,
  loadGpaScale,
  saveGpaRows,
  saveGpaScale,
} from "@/components/gpa/gpa-storage"
import { DEFAULT_GPA_SCALE as DEFAULT_SCALE_FALLBACK } from "@/components/gpa/gpa-scale"

/**
 * GPA калькулятор: редактируемые предметы с кредитами, шкала KZ 4.0,
 * what-if прогноз и графики успеваемости. Роут подключает основной агент.
 */
export default function GpaPage() {
  const {
    loading,
    subjects,
    canvasCourses,
    canvasAssignments,
    canvasCourseMap,
    platonusYears,
    activeCourse,
    activeSemester,
    calendar,
  } = useAristosDB()

  // Manual rows (persisted); null = derive from Platonus/Canvas data
  const [manualRows, setManualRows] = useState<GpaRow[] | null>(() =>
    loadGpaRows()
  )
  const [scale, setScale] = useState<GpaScaleTier[]>(
    () => loadGpaScale() ?? DEFAULT_GPA_SCALE
  )
  const [importedCount, setImportedCount] = useState<number | null>(null)

  const derivedRows = useMemo(
    () =>
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

  // User's manual edits win; otherwise auto-derived from data
  const rows = manualRows ?? (loading ? null : derivedRows)

  useEffect(() => {
    if (rows !== null) saveGpaRows(rows)
  }, [rows])

  useEffect(() => {
    if (scale.length > 0) saveGpaScale(scale)
  }, [scale])

  const current = useMemo(
    () => computeGpa(rows ?? [], scale, "current"),
    [rows, scale]
  )
  const projected = useMemo(
    () => computeGpa(rows ?? [], scale, "projected"),
    [rows, scale]
  )

  const semester = useMemo(
    () => calendar?.semesters?.find((sem) => sem.semester === activeSemester),
    [calendar, activeSemester]
  )

  const rkData = useMemo(
    () =>
      canvasCourses.map((course) => {
        const breakdown = computeCourseGrades(
          course,
          canvasAssignments,
          semester
        )
        return { code: course.code, rk1: breakdown.rk1, rk2: breakdown.rk2 }
      }),
    [canvasCourses, canvasAssignments, semester]
  )

  const resetRows = () => {
    setManualRows(
      deriveGpaRows({
        subjects,
        activeCourse,
        activeSemester,
        platonusYears,
        canvasCourses,
        canvasCourseMap,
      })
    )
  }

  if (loading || rows === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="mb-2">
        <p className="text-sm font-medium text-primary">{kk.gpaBadge}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {kk.gpaTitle}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">{kk.gpaSubtitle}</p>
      </header>

      <GpaSummary current={current} projected={projected} />

      <Card className="border-border/80 shadow-xs">
        {/* на мобиле заголовок и кнопки — стопкой, иначе длинные подписи жмутся до одного слова в строке */}
        <CardHeader className="items-start justify-between space-y-0 sm:flex-row">
          <div className="min-w-0 space-y-1.5">
            <CardTitle>{kk.subjects}</CardTitle>
            <CardDescription>{kk.gpaSubjectsDesc}</CardDescription>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1 sm:mt-0 sm:shrink-0">
            <TranscriptImport
              onImport={(imported) => {
                // импорт замещает строки: транскрипт — самый полный источник
                setManualRows(imported)
                setImportedCount(imported.length)
                window.setTimeout(() => setImportedCount(null), 6000)
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={resetRows}
              className="shrink-0 text-muted-foreground"
            >
              <RotateCcw className="size-3.5" />
              {kk.reset}
            </Button>
          </div>
        </CardHeader>
        {importedCount !== null && (
          <p className="px-6 pb-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {kk.gpaImportDone(importedCount)}
          </p>
        )}
        <CardContent>
          <GpaRowsTable rows={rows} scale={scale} onChange={setManualRows} />
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-xs">
        <CardHeader className="items-start justify-between space-y-0 sm:flex-row">
          <div className="min-w-0 space-y-1.5">
            <CardTitle>{kk.gpaScaleTitle}</CardTitle>
            <CardDescription>{kk.gpaScaleDesc}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale(DEFAULT_SCALE_FALLBACK)}
            className="mt-3 shrink-0 text-muted-foreground sm:mt-0"
          >
            <RotateCcw className="size-3.5" />
            {kk.reset}
          </Button>
        </CardHeader>
        <CardContent>
          <ScaleEditor scale={scale} onChange={setScale} />
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-tight">
          {kk.gpaChartsTitle}
        </h2>
        <GradeDynamics assignments={canvasAssignments} />
        <div className="grid gap-4 lg:grid-cols-2">
          <DeadlineBars assignments={canvasAssignments} />
          <RkCompare data={rkData} />
        </div>
      </section>
    </div>
  )
}
