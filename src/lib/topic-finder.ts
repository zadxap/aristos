import type { Subject, ScheduleEntry } from '@/types'

/**
 * Finds the subject behind a timetable entry: by subject_id first, then —
 * when the schedule and the subject JSON disagree on ids (hand-made or
 * AI-generated JSONs often invent their own subject_id) — by normalized name.
 * Without the name fallback such a subject silently loses all its lesson topics.
 */
export function findSubjectForEntry(
  subjects: Subject[],
  entry: Pick<ScheduleEntry, 'subject_id' | 'subject_name'>
): Subject | undefined {
  const byId = subjects.find((s) => s.subject_id === entry.subject_id)
  if (byId) return byId

  const target = normalizeSubjectName(entry.subject_name)
  if (!target) return undefined
  return subjects.find((s) => normalizeSubjectName(s.subject_name) === target)
}

function normalizeSubjectName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s«»"'.:,;()\-–—]/g, '')
    .trim()
}

/**
 * Finds the topic for a subject based on lesson type and current academic week.
 * Falls back to matching just the week if exact type isn't found.
 */
export function findTopicForLesson(
  subject: Subject | undefined,
  type: string | null,
  week: number
): string | undefined {
  if (!subject || !subject.topics || subject.topics.length === 0) {
    return undefined
  }

  // 1. Exact match by type and week
  if (type) {
    const exact = subject.topics.find(
      (t) => t.type.toLowerCase() === type.toLowerCase() && t.week === week
    )
    if (exact) return exact.topic
  }

  // 2. Match by week with preferred types
  const forWeek = subject.topics.filter((t) => t.week === week)
  if (forWeek.length > 0) {
    if (type) {
      const partial = forWeek.find((t) =>
        t.type.toLowerCase().includes(type.toLowerCase())
      )
      if (partial) return partial.topic
    }
    return forWeek[0].topic
  }

  return undefined
}
