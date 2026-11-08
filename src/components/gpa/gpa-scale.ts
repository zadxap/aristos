/** КZ 4.0 letter scale and weighted GPA math. */

export interface GpaScaleTier {
  letter: string
  points: number
  /** inclusive lower bound of the percent range; the upper bound is the next tier's min − 1 */
  min: number
}

export const DEFAULT_GPA_SCALE: GpaScaleTier[] = [
  { letter: 'A', points: 4.0, min: 95 },
  { letter: 'A-', points: 3.67, min: 90 },
  { letter: 'B+', points: 3.33, min: 85 },
  { letter: 'B', points: 3.0, min: 80 },
  { letter: 'B-', points: 2.67, min: 75 },
  { letter: 'C+', points: 2.33, min: 70 },
  { letter: 'C', points: 2.0, min: 65 },
  { letter: 'C-', points: 1.67, min: 60 },
  { letter: 'D+', points: 1.33, min: 55 },
  { letter: 'D', points: 1.0, min: 50 },
  { letter: 'F', points: 0, min: 0 },
]

export interface GpaRow {
  id: string
  name: string
  /** kept as raw input text so the user can type decimals freely */
  credits: string
  /** итоговый % (from Platonus / Canvas or typed by hand) */
  percent: string
  /** what-if прогноз % — counts only when percent is empty */
  forecast: string
  include: boolean
}

export function newGpaRowId(): string {
  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Parses a numeric input value; "" and garbage → null. Accepts comma as the decimal separator. */
export function parseNum(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (normalized === '') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

/** Letter tier for a percent: the tier with the highest min that the percent still reaches. */
export function percentToTier(percent: number, scale: GpaScaleTier[]): GpaScaleTier | null {
  if (scale.length === 0) return null
  const sorted = [...scale].sort((a, b) => b.min - a.min)
  return sorted.find((tier) => percent >= tier.min) ?? sorted[sorted.length - 1]
}

export type GpaMode = 'current' | 'projected'

export interface GpaResult {
  gpa: number | null
  /** credits that actually took part in the calculation */
  creditsUsed: number
  /** credits of all included rows (with or without a percent yet) */
  creditsTotal: number
}

/**
 * GPA = Σ(кредиты × балл) / Σ(кредиты) — over included rows with credits.
 * `current` counts rows with an итоговый % only; `projected` also counts
 * rows whose percent is empty but a what-if прогноз is filled in.
 */
export function computeGpa(rows: GpaRow[], scale: GpaScaleTier[], mode: GpaMode): GpaResult {
  let weighted = 0
  let creditsUsed = 0
  let creditsTotal = 0
  for (const row of rows) {
    if (!row.include) continue
    const credits = parseNum(row.credits)
    if (credits === null || credits <= 0) continue
    creditsTotal += credits
    const percent = parseNum(row.percent) ?? (mode === 'projected' ? parseNum(row.forecast) : null)
    if (percent === null) continue
    const tier = percentToTier(percent, scale)
    if (!tier) continue
    weighted += credits * tier.points
    creditsUsed += credits
  }
  return {
    gpa: creditsUsed > 0 ? weighted / creditsUsed : null,
    creditsUsed,
    creditsTotal,
  }
}
