import type { ScheduleEntry, Subject, DayOfWeek } from '@/types'
import { useEffect, useState } from 'react'
import { LessonRow } from './LessonRow'
import { findTopicForLesson } from '@/lib/topic-finder'
import { kk } from '@/i18n'
import { BookOpen } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface LessonListProps {
  entries: ScheduleEntry[]
  subjects: Subject[]
  currentWeek: number
  selectedDay: DayOfWeek
  editMode?: boolean
  onDeleteEntry?: (index: number) => void
  onEditEntry?: (index: number, entry: ScheduleEntry) => void
}

const DAY_KEYS: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function nowMinutes(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Тикает раз в 30 секунд — подсветка «қазір» обновляется сама. */
function useNowMinutes(): number {
  const [minutes, setMinutes] = useState(nowMinutes)
  useEffect(() => {
    const timer = setInterval(() => setMinutes(nowMinutes()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return minutes
}

export function LessonList({
  entries,
  subjects,
  currentWeek,
  selectedDay,
  editMode = false,
  onDeleteEntry,
  onEditEntry,
}: LessonListProps) {
  const nowMin = useNowMinutes()
  const isToday = selectedDay === DAY_KEYS[new Date().getDay()]

  // 'now' — пара идёт прямо сейчас; иначе первая пара, которая ещё начнётся сегодня.
  const states: ('now' | 'next' | undefined)[] = entries.map((entry) => {
    if (!isToday) return undefined
    const start = timeToMinutes(entry.start)
    const end = timeToMinutes(entry.end)
    return nowMin >= start && nowMin < end ? 'now' : undefined
  })
  if (isToday && !states.includes('now')) {
    const nextIdx = entries.findIndex((entry) => timeToMinutes(entry.start) > nowMin)
    if (nextIdx !== -1) states[nextIdx] = 'next'
  }

  if (entries.length === 0) {
    return (
      <div className="py-12 px-4 rounded-2xl border border-dashed border-border/80 text-center bg-muted/20">
        <BookOpen className="size-8 mx-auto text-muted-foreground/60 mb-2" />
        <p className="text-sm font-medium text-foreground">
          {kk.noLessonsToday}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {kk.noPlannedFull(kk.daysFull[selectedDay])}
        </p>
      </div>
    )
  }

  return (
    <Card className="divide-y divide-border/60 overflow-hidden py-0">
      {entries.map((entry, idx) => {
        const sub = subjects.find((s) => s.subject_id === entry.subject_id)
        const topic = findTopicForLesson(sub, entry.type, currentWeek)

        return (
          <LessonRow
            key={`${entry.day}-${entry.start}-${idx}`}
            entry={entry}
            topic={topic}
            highlight={states[idx]}
            editMode={editMode}
            onDelete={onDeleteEntry ? () => onDeleteEntry(idx) : undefined}
            onEdit={onEditEntry ? (updated) => onEditEntry(idx, updated) : undefined}
          />
        )
      })}
    </Card>
  )
}
