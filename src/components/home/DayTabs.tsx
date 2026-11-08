import type { DayOfWeek } from '@/types'
import { kk } from '@/i18n'

interface DayTabsProps {
  selectedDay: DayOfWeek
  onSelectDay: (day: DayOfWeek) => void
}

const DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const JS_DAY_MAP: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function DayTabs({ selectedDay, onSelectDay }: DayTabsProps) {
  const todayIndex = new Date().getDay()
  const todayKey = JS_DAY_MAP[todayIndex]

  return (
    <div className="flex min-w-0 items-center justify-between gap-0.5 rounded-2xl border border-border/60 bg-muted/40 p-1 select-none">
      {DAYS.map((day) => {
        const isSelected = selectedDay === day
        const isToday = todayKey === day

        return (
          <button
            key={day}
            onClick={() => onSelectDay(day)}
            className={`relative min-w-0 flex-1 rounded-xl px-0.5 py-2 text-center transition-all duration-200 sm:px-1 ${
              isSelected
                ? 'bg-card text-foreground font-semibold shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
            }`}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-semibold">{kk.days[day]}</span>
              {isToday && (
                <span
                  className={`size-1 rounded-full ${
                    isSelected ? 'bg-primary' : 'bg-muted-foreground'
                  }`}
                />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
