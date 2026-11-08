import { kk } from '@/i18n'
import { parseNum, type GpaScaleTier } from './gpa-scale'

const NUM_INPUT_CLASS =
  'w-full rounded-lg border border-border/80 bg-card px-2 py-1 text-sm text-foreground tabular-nums shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-primary/40'

interface ScaleEditorProps {
  scale: GpaScaleTier[]
  onChange: (scale: GpaScaleTier[]) => void
}

/**
 * Редактируемая шкала KZ 4.0: балл и нижняя граница % у каждой буквы.
 * Инпуты неконтролируемые (свободный ввод десятичных), значение фиксируется по blur.
 */
export function ScaleEditor({ scale, onChange }: ScaleEditorProps) {
  const sorted = [...scale].sort((a, b) => b.min - a.min)
  const signature = scale.map((tier) => `${tier.letter}:${tier.points}:${tier.min}`).join('|')

  const commit = (tier: GpaScaleTier, field: 'points' | 'min', raw: string, element: HTMLInputElement) => {
    const parsed = parseNum(raw)
    const value = parsed ?? tier[field]
    element.value = String(value)
    if (value === tier[field]) return
    onChange(
      scale.map((t) =>
        t.letter === tier.letter ? (field === 'points' ? { ...t, points: value } : { ...t, min: value }) : t
      )
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] max-w-md text-sm" key={signature}>
          <thead>
            <tr className="border-b border-border/60 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2">{kk.gpaLetterCol}</th>
              <th className="px-2 py-2 text-right">{kk.gpaPointsCol}</th>
              <th className="px-2 py-2 text-right">{kk.gpaMinCol}</th>
              <th className="px-2 py-2 text-right">{kk.gpaRangeCol}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((tier, index) => {
              const max = index === 0 ? 100 : Math.max(0, sorted[index - 1].min - 1)
              return (
                <tr key={tier.letter} className="border-b border-border/40 last:border-b-0">
                  <td className="px-2 py-1 font-semibold">{tier.letter}</td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      max={4}
                      step="0.01"
                      defaultValue={String(tier.points)}
                      onBlur={(e) => commit(tier, 'points', e.currentTarget.value, e.currentTarget)}
                      className={`${NUM_INPUT_CLASS} text-right`}
                      aria-label={kk.gpaPointsFor(tier.letter)}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      defaultValue={String(tier.min)}
                      onBlur={(e) => commit(tier, 'min', e.currentTarget.value, e.currentTarget)}
                      className={`${NUM_INPUT_CLASS} text-right`}
                      aria-label={kk.gpaMinFor(tier.letter)}
                    />
                  </td>
                  <td className="px-2 py-1 text-right text-xs tabular-nums text-muted-foreground">
                    {tier.min}–{max}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {kk.gpaScaleNote}
      </p>
    </div>
  )
}
