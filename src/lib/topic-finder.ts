import type { Subject } from '@/types'

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
