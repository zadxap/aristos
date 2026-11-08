import { emptyGpaRow } from './gpa-data'
import { type GpaRow, type GpaScaleTier } from './gpa-scale'

export const GPA_ROWS_KEY = 'gpa-rows-v1'
export const GPA_SCALE_KEY = 'gpa-scale-v1'

/** Saved rows → validated GpaRow[]; broken or empty storage → null (caller re-derives). */
export function loadGpaRows(): GpaRow[] | null {
  try {
    const raw = localStorage.getItem(GPA_ROWS_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const seen = new Set<string>()
    const rows: GpaRow[] = []
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue
      const record = item as Record<string, unknown>
      let id = typeof record.id === 'string' && record.id !== '' ? record.id : emptyGpaRow().id
      while (seen.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 6)}`
      seen.add(id)
      rows.push({
        id,
        name: typeof record.name === 'string' ? record.name : '',
        credits: typeof record.credits === 'string' ? record.credits : '',
        percent: typeof record.percent === 'string' ? record.percent : '',
        forecast: typeof record.forecast === 'string' ? record.forecast : '',
        include: record.include !== false,
      })
    }
    return rows.length > 0 ? rows : null
  } catch {
    return null
  }
}

export function saveGpaRows(rows: GpaRow[]): void {
  try {
    localStorage.setItem(GPA_ROWS_KEY, JSON.stringify(rows))
  } catch {
    /* хранилище недоступно — не критично */
  }
}

/** Saved scale → validated tiers; anything off → null (caller uses the default). */
export function loadGpaScale(): GpaScaleTier[] | null {
  try {
    const raw = localStorage.getItem(GPA_SCALE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const tiers: GpaScaleTier[] = []
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) return null
      const record = item as Record<string, unknown>
      const letter = typeof record.letter === 'string' && record.letter !== '' ? record.letter : null
      const points = typeof record.points === 'number' && Number.isFinite(record.points) ? record.points : null
      const min = typeof record.min === 'number' && Number.isFinite(record.min) ? record.min : null
      if (letter === null || points === null || min === null) return null
      tiers.push({ letter, points, min })
    }
    return tiers
  } catch {
    return null
  }
}

export function saveGpaScale(scale: GpaScaleTier[]): void {
  try {
    localStorage.setItem(GPA_SCALE_KEY, JSON.stringify(scale))
  } catch {
    /* хранилище недоступно — не критично */
  }
}
