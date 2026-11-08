/** Badge/visual tone for a Canvas percentage score. */
export function scoreBadgeVariant(score: number | null): 'emerald' | 'blue' | 'amber' | 'rose' | 'outline' {
  if (score === null) return 'outline'
  if (score >= 85) return 'emerald'
  if (score >= 70) return 'blue'
  if (score >= 60) return 'amber'
  return 'rose'
}
