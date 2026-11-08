import { CalendarClock } from "lucide-react"
import type { ScheduleEntry } from "@/types"
import { kk } from "@/i18n"
import { Card, CardContent } from "@/components/ui/card"

interface TomorrowScheduleProps {
  entries: ScheduleEntry[]
  /** название дня («Жұма» / «Пятница») */
  dayLabel: string
  isAcademicPeriod: boolean
}

/** «Расписание на завтра»: компактный список пар на следующий день. */
export function TomorrowSchedule({
  entries,
  dayLabel,
  isAcademicPeriod,
}: TomorrowScheduleProps) {
  return (
    <Card className="border-border/80 shadow-xs">
      <CardContent className="p-4">
        <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground">
          <CalendarClock className="size-4 text-primary" />
          {kk.tomorrowSchedule}
          <span className="font-normal text-muted-foreground">
            · {dayLabel}
          </span>
        </h3>

        {!isAcademicPeriod ? (
          <p className="py-2 text-xs text-muted-foreground">
            {kk.outOfSemester}
          </p>
        ) : entries.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            {kk.tomorrowEmpty}
          </p>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry, i) => (
              <div
                key={`${entry.start}-${i}`}
                className="flex min-w-0 items-center gap-2.5 rounded-lg bg-muted/30 px-2.5 py-1.5"
              >
                <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary tabular-nums">
                  {entry.start}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                  {entry.subject_name}
                </span>
                {entry.room && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {entry.room}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
