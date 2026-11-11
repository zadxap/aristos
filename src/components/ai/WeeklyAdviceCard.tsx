import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, RefreshCw, Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { kk } from "@/i18n"
import { useAristosDB } from "@/context/DBContext"
import { buildAdvisorContext } from "@/lib/aiContext"
import { effectiveDeadline } from "@/lib/canvas"
import { chatComplete, isAiConfigured, loadAiSettings } from "@/lib/aiClient"
import type { AcadCalendar, CanvasAssignment, CanvasCourse } from "@/types"

const SYSTEM_PROMPT = `Ты — академический советник студента казахстанского вуза (Yessenov University).
Отвечай по-русски, кратко и по делу, структурировано:
1) Сильные стороны
2) Слабые места
3) Конкретные действия на неделю
4) Риски (близкие дедлайны, пропуски, что повлияет на рейтинг)
Используй ТОЛЬКО данные из контекста — не выдумывай цифры, названия предметов или даты.
Схема оценивания: РК1 + РК2 → Рейтинг = (РК1+РК2)/2, Итог = 0.6×Рейтинг + 0.4×Экзамен.`

function renderBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function SimpleMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split("\n").map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} className="h-1" />
        if (trimmed.startsWith("## "))
          return (
            <p key={i} className="pt-1 text-sm font-semibold text-foreground">
              {trimmed.slice(3)}
            </p>
          )
        if (/^[-•*]\s/.test(trimmed)) {
          return (
            <p
              key={i}
              className="flex gap-1.5 text-xs leading-relaxed text-foreground/90"
            >
              <span className="shrink-0 text-primary">•</span>
              <span>{renderBold(trimmed.replace(/^[-•*]\s/, ""))}</span>
            </p>
          )
        }
        if (/^\d+[.)]\s/.test(trimmed)) {
          const num = trimmed.match(/^\d+/)?.[0] ?? ""
          return (
            <p
              key={i}
              className="flex gap-1.5 text-xs leading-relaxed text-foreground/90"
            >
              <span className="shrink-0 font-semibold text-primary">
                {num}.
              </span>
              <span>{renderBold(trimmed.replace(/^\d+[.)]\s/, ""))}</span>
            </p>
          )
        }
        return (
          <p key={i} className="text-xs leading-relaxed text-foreground/90">
            {renderBold(trimmed)}
          </p>
        )
      })}
    </div>
  )
}

/** Compact AI advice card on the home page. Hidden unless AI is configured and data exists. */
/** Локальный совет без AI: считаем по реальным данным — ближайший дедлайн,
 *  пропущенные работы, самый слабый курс, ближайший рубежный контроль. */
function buildLocalAdvice(ctx: {
  canvasAssignments: CanvasAssignment[]
  canvasCourses: CanvasCourse[]
  calendar: AcadCalendar | undefined
  activeSemester: number
}): string {
  const now = Date.now()
  const lines: string[] = []

  const upcoming = ctx.canvasAssignments
    .filter((a) => !a.graded && effectiveDeadline(a) && new Date(effectiveDeadline(a)!).getTime() > now)
    .sort((a, b) => (effectiveDeadline(a) ?? "").localeCompare(effectiveDeadline(b) ?? ""))[0]
  if (upcoming && effectiveDeadline(upcoming)) {
    const days = Math.ceil(
      (new Date(effectiveDeadline(upcoming)!).getTime() - now) / 86_400_000
    )
    lines.push(
      `**${kk.adviceNearest}:** «${upcoming.title}» — ${days <= 0 ? kk.adviceToday : kk.daysN(days)}`
    )
  }

  const missing = ctx.canvasAssignments.filter((a) => a.missing).length
  if (missing > 0) lines.push(`**${kk.adviceMissing}:** ${missing}`)

  const scored = ctx.canvasCourses.filter((c) => c.current_score !== null)
  if (scored.length > 0) {
    const weakest = scored.reduce((min, c) =>
      (c.current_score ?? 100) < (min.current_score ?? 100) ? c : min
    )
    lines.push(
      `**${kk.adviceWeakest}:** ${weakest.code} — ${weakest.current_score}%`
    )
  }

  const sem = ctx.calendar?.semesters?.find(
    (s) => s.semester === ctx.activeSemester
  )
  const nextRk = sem?.midterm_controls?.find(
    (r) => new Date(`${r.end}T23:59:59`).getTime() >= now
  )
  if (nextRk)
    lines.push(
      `**${kk.adviceRk}:** ${nextRk.name ?? "РК"} — ${nextRk.start} … ${nextRk.end}`
    )

  return lines.length > 0 ? lines.join("\n") : kk.radarEmpty
}

export function WeeklyAdviceCard() {
  const {
    canvasAssignments,
    canvasCourses,
    platonusYears,
    subjects,
    activeCourse,
    activeSemester,
    calendar,
  } = useAristosDB()
  const [settings] = useState(() => loadAiSettings())
  const [advice, setAdvice] = useState<string | null>(() => {
    try {
      const cached = localStorage.getItem("weekly-advice")
      return cached ? (JSON.parse(cached) as { text: string }).text : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const configured = isAiConfigured(settings)
  const hasData = canvasAssignments.length > 0

  const localAdvice = useMemo(
    () =>
      buildLocalAdvice({
        canvasAssignments,
        canvasCourses,
        calendar,
        activeSemester,
      }),
    [canvasAssignments, canvasCourses, calendar, activeSemester]
  )

  if (!hasData) return null

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const context = buildAdvisorContext({
        activeCourse,
        activeSemester,
        canvasCourses,
        canvasAssignments,
        platonusYears,
        subjects,
        calendar,
      })
      const result = await chatComplete(
        settings,
        SYSTEM_PROMPT,
        `Дай «Совет недели» на основе данных студента.\n\n${context}`
      )
      setAdvice(result)
      localStorage.setItem(
        "weekly-advice",
        JSON.stringify({ text: result, at: new Date().toISOString() })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-border/80 shadow-xs">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <Sparkles className="size-4 text-primary" />
            {kk.advisorWeekly}
          </h3>
          {configured ? (
            <button
              onClick={() => void generate()}
              disabled={loading}
              className="-m-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary disabled:opacity-50"
              title={kk.refresh}
            >
              <RefreshCw
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          ) : (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {kk.adviceLocalBadge}
            </Badge>
          )}
        </div>
        {loading ? (
          <p className="animate-pulse text-xs text-muted-foreground">
            {kk.aiAnalyzing}
          </p>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : advice ? (
          <SimpleMarkdown text={advice} />
        ) : (
          <SimpleMarkdown text={localAdvice} />
        )}
        {!configured && (
          <p className="text-[10px] text-muted-foreground/80">
            {kk.adviceLocalNote}
          </p>
        )}
        <Link
          to="/advisor"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {kk.advisorTitle}
          <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  )
}
