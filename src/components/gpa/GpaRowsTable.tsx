import { Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { kk } from "@/i18n"
import { scoreBadgeVariant } from "@/lib/score-tone"
import { cn } from "@/lib/utils"
import { emptyGpaRow } from "./gpa-data"
import {
  parseNum,
  percentToTier,
  type GpaRow,
  type GpaScaleTier,
} from "./gpa-scale"

const INPUT_CLASS =
  "w-full rounded-lg border border-border/80 bg-card px-2 py-1.5 text-sm text-foreground shadow-xs transition-all placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
const NUM_INPUT_CLASS = `${INPUT_CLASS} text-right tabular-nums`

interface GpaRowsTableProps {
  rows: GpaRow[]
  scale: GpaScaleTier[]
  onChange: (rows: GpaRow[]) => void
}

/** Редактируемая таблица предметов: кредиты, итоговый %, буква, what-if прогноз, вкл/выкл. */
export function GpaRowsTable({ rows, scale, onChange }: GpaRowsTableProps) {
  const update = (id: string, patch: Partial<GpaRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  const remove = (id: string) => onChange(rows.filter((row) => row.id !== id))
  const add = () => onChange([...rows, emptyGpaRow()])

  // буква по текущему % (итог, иначе прогноз) — общая для таблицы и мобильных карточек
  const tierOf = (row: GpaRow) => {
    const finalPercent = parseNum(row.percent)
    const shownPercent = finalPercent ?? parseNum(row.forecast)
    const tier =
      shownPercent !== null ? percentToTier(shownPercent, scale) : null
    return { finalPercent, shownPercent, tier }
  }

  return (
    <div className="space-y-3">
      {/* Мобайл: карточка на предмет — таблица на 680px в экран не влезает */}
      <div className="space-y-2 sm:hidden">
        {rows.map((row) => {
          const { finalPercent, shownPercent, tier } = tierOf(row)
          return (
            <div
              key={row.id}
              className={cn(
                "rounded-xl border border-border/70 bg-muted/20 p-3",
                !row.include && "opacity-45"
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => update(row.id, { name: e.target.value })}
                  placeholder={kk.subjectName}
                  className={INPUT_CLASS}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(row.id)}
                  title={kk.deleteRow}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <label className="min-w-0 space-y-1">
                  <span className="block text-[10px] leading-tight font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase">
                    {kk.gpaCreditsCol}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={row.credits}
                    onChange={(e) =>
                      update(row.id, { credits: e.target.value })
                    }
                    placeholder="3"
                    title={kk.gpaCreditsTitle}
                    className={NUM_INPUT_CLASS}
                  />
                </label>
                <label className="min-w-0 space-y-1">
                  <span className="block text-[10px] leading-tight font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase">
                    {kk.gpaFinalColShort}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    inputMode="decimal"
                    value={row.percent}
                    onChange={(e) =>
                      update(row.id, { percent: e.target.value })
                    }
                    placeholder="—"
                    title={kk.gpaFinalTitle}
                    className={NUM_INPUT_CLASS}
                  />
                </label>
                <label className="min-w-0 space-y-1">
                  <span className="block text-[10px] leading-tight font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase">
                    {kk.gpaForecastColShort}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    inputMode="decimal"
                    value={row.forecast}
                    onChange={(e) =>
                      update(row.id, { forecast: e.target.value })
                    }
                    placeholder={kk.goalPlaceholder}
                    title={kk.gpaForecastTitle}
                    className={cn(
                      NUM_INPUT_CLASS,
                      finalPercent !== null && "opacity-50"
                    )}
                  />
                </label>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={(e) =>
                      update(row.id, { include: e.target.checked })
                    }
                    title={kk.gpaIncludeTitle}
                    className="size-4 cursor-pointer accent-primary"
                  />
                  {kk.gpaIncludeCol}
                </label>
                {tier && shownPercent !== null ? (
                  <Badge
                    variant={scoreBadgeVariant(shownPercent)}
                    className="px-2 py-0 text-[11px]"
                    title={`${tier.letter} = ${tier.points.toFixed(2)}${finalPercent === null ? ` · ${kk.forecastWord}` : ""}`}
                  >
                    {tier.letter}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Десктоп/планшет: полноценная таблица */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <th className="px-2 py-2">{kk.subjects}</th>
              <th className="w-20 px-2 py-2 text-right">{kk.gpaCreditsCol}</th>
              <th className="w-24 px-2 py-2 text-right">{kk.gpaFinalCol}</th>
              <th className="w-16 px-2 py-2 text-center">{kk.gpaLetterCol}</th>
              <th className="w-24 px-2 py-2 text-right">{kk.gpaForecastCol}</th>
              <th
                className="w-14 px-2 py-2 text-center"
                title={kk.gpaIncludeTitle}
              >
                {kk.gpaIncludeCol}
              </th>
              <th className="w-9 px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { finalPercent, shownPercent, tier } = tierOf(row)
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/40 last:border-b-0",
                    !row.include && "opacity-45"
                  )}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => update(row.id, { name: e.target.value })}
                      placeholder={kk.subjectName}
                      className={INPUT_CLASS}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={row.credits}
                      onChange={(e) =>
                        update(row.id, { credits: e.target.value })
                      }
                      placeholder="3"
                      title={kk.gpaCreditsTitle}
                      className={NUM_INPUT_CLASS}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      inputMode="decimal"
                      value={row.percent}
                      onChange={(e) =>
                        update(row.id, { percent: e.target.value })
                      }
                      placeholder="—"
                      title={kk.gpaFinalTitle}
                      className={NUM_INPUT_CLASS}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {tier && shownPercent !== null ? (
                      <Badge
                        variant={scoreBadgeVariant(shownPercent)}
                        className="px-2 py-0 text-[11px]"
                        title={`${tier.letter} = ${tier.points.toFixed(2)}${finalPercent === null ? ` · ${kk.forecastWord}` : ""}`}
                      >
                        {tier.letter}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      inputMode="decimal"
                      value={row.forecast}
                      onChange={(e) =>
                        update(row.id, { forecast: e.target.value })
                      }
                      placeholder={kk.goalPlaceholder}
                      title={kk.gpaForecastTitle}
                      className={cn(
                        NUM_INPUT_CLASS,
                        finalPercent !== null && "opacity-50"
                      )}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={(e) =>
                        update(row.id, { include: e.target.checked })
                      }
                      title={kk.gpaIncludeTitle}
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </td>
                  <td className="px-1 py-1.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => remove(row.id)}
                      title={kk.deleteRow}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="size-3.5 text-primary" />
          {kk.gpaAddSubject}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          {kk.gpaForecastHint}
        </p>
      </div>
    </div>
  )
}
