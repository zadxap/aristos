import type { CSSProperties } from 'react'

/**
 * Shared recharts palette: one blue accent + supporting tones.
 * No rainbow, no gradients — series colors come from here.
 */
export const CHART_COLORS = {
  accent: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
} as const

/** Shared Tooltip look — project surface colors via CSS variables (dark/light aware). */
export const TOOLTIP_CONTENT_STYLE: CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
}

export const TOOLTIP_ITEM_STYLE: CSSProperties = {
  paddingTop: 2,
  paddingBottom: 2,
}

export const TOOLTIP_CURSOR_STYLE = {
  fill: 'var(--muted)',
  opacity: 0.4,
}

export const AXIS_TICK = {
  fontSize: 11,
  fill: 'var(--muted-foreground)',
}

export const GRID_STROKE = 'var(--border)'

/** Truncate long course codes for the X axis; the full code stays in the tooltip label. */
export function shortenCode(code: string, max = 9): string {
  return code.length > max ? `${code.slice(0, max - 1)}…` : code
}
