import type {
  Schedule,
  AcadCalendar,
  Subject,
  CurrentStatus,
  DayOfWeek,
} from '@/types'
import { kk } from '@/i18n'
import { getAcademicWeek } from './academic-week'
import { findTopicForLesson } from './topic-finder'

const DAYS_MAP: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** «123 минут» → «2 ч 3 мин»: часы+минуты, нули опускаются («2 ч», «45 мин»). */
export function formatRemainingMinutes(total: number): string {
  const safe = Math.max(0, Math.floor(total))
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  if (hours > 0 && minutes > 0) return `${hours} ${kk.unitHour} ${minutes} ${kk.unitMin}`
  if (hours > 0) return `${hours} ${kk.unitHour}`
  return `${minutes} ${kk.unitMin}`
}

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function formatDateToIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
  return dateStr >= startStr && dateStr <= endStr
}

export function getCurrentStatus(
  now: Date,
  schedule: Schedule | undefined,
  calendar: AcadCalendar | undefined,
  subjects: Subject[],
  activeSemester = 1
): CurrentStatus {
  const todayStr = formatDateToIso(now)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const dayOfWeek = DAYS_MAP[now.getDay()]

  // 1. Check holidays across semesters
  if (calendar && calendar.semesters) {
    for (const sem of calendar.semesters) {
      if (sem.holidays) {
        for (const h of sem.holidays) {
          if (isDateInRange(todayStr, h.start, h.end)) {
            return {
              type: 'holiday',
              label: h.name || kk.holidayPeriod,
              periodName: h.name || kk.holidayName,
            }
          }
        }
      }
    }
  }

  // 2. Check practices
  if (calendar && calendar.practices) {
    for (const p of calendar.practices) {
      if (isDateInRange(todayStr, p.start, p.end)) {
        return {
          type: 'practice',
          label: p.name || kk.practiceName,
          periodName: p.name || kk.practiceName,
        }
      }
    }
  }

  // Find active semester calendar
  const activeSemCalendar = calendar?.semesters?.find(
    (s) => s.semester === activeSemester
  )

  if (!activeSemCalendar || todayStr < activeSemCalendar.semester_start || todayStr > activeSemCalendar.semester_end) {
    return {
      type: 'free_day',
      label: kk.outOfSemester,
      sublabel: kk.outOfSemesterDesc,
    }
  }

  // 3. Check exam period
  if (activeSemCalendar?.exam_period) {
    const { start, end } = activeSemCalendar.exam_period
    if (isDateInRange(todayStr, start, end)) {
      return {
        type: 'exam',
        label: kk.exam,
        periodName: kk.exam,
      }
    }
  }

  // Calculate current academic week
  const currentWeek = activeSemCalendar
    ? getAcademicWeek(
        now,
        activeSemCalendar.semester_start,
        activeSemCalendar.total_weeks
      )
    : 1

  // 4. Check midterm controls
  let activeMidtermName: string | undefined
  if (activeSemCalendar?.midterm_controls) {
    for (const mc of activeSemCalendar.midterm_controls) {
      if (isDateInRange(todayStr, mc.start, mc.end)) {
        activeMidtermName = mc.name || kk.midterm
        break
      }
    }
  }

  // 5. Check today's schedule
  const todayEntries = (schedule?.schedule || [])
    .filter((entry) => entry.day.toLowerCase() === dayOfWeek)
    .sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start))

  if (todayEntries.length === 0) {
    return {
      type: 'free_day',
      label: kk.freeDay,
      sublabel: activeMidtermName,
      periodName: activeMidtermName,
    }
  }

  // Look for current lesson or break
  const firstEntry = todayEntries[0]
  const firstStartMin = parseTimeToMinutes(firstEntry.start)

  // If before first lesson of the day (including early morning / night)
  if (currentMinutes < firstStartMin) {
    const minutesUntil = firstStartMin - currentMinutes
    const sub = subjects.find((s) => s.subject_id === firstEntry.subject_id)
    const topic = findTopicForLesson(sub, firstEntry.type, currentWeek)

    return {
      type: 'before_start',
      label: kk.upcomingLesson,
      sublabel: activeMidtermName,
      nextEntry: firstEntry,
      minutesUntilNext: minutesUntil,
      topic,
      periodName: activeMidtermName,
    }
  }

  for (let i = 0; i < todayEntries.length; i++) {
    const entry = todayEntries[i]
    const startMin = parseTimeToMinutes(entry.start)
    const endMin = parseTimeToMinutes(entry.end)

    // Current lesson in progress
    if (currentMinutes >= startMin && currentMinutes < endMin) {
      const duration = endMin - startMin
      const elapsed = currentMinutes - startMin
      const progress = duration > 0 ? Math.min(Math.max(elapsed / duration, 0), 1) : 0
      const minutesLeft = endMin - currentMinutes

      const sub = subjects.find((s) => s.subject_id === entry.subject_id)
      const topic = findTopicForLesson(sub, entry.type, currentWeek)

      return {
        type: 'in_class',
        label: kk.statusInClass,
        sublabel: activeMidtermName,
        entry,
        topic,
        minutesLeft,
        progress,
        periodName: activeMidtermName,
      }
    }

    // Break between lessons
    if (i < todayEntries.length - 1) {
      const nextEntry = todayEntries[i + 1]
      const nextStartMin = parseTimeToMinutes(nextEntry.start)

      if (currentMinutes >= endMin && currentMinutes < nextStartMin) {
        const minutesUntilNext = nextStartMin - currentMinutes
        const nextSub = subjects.find(
          (s) => s.subject_id === nextEntry.subject_id
        )
        const nextTopic = findTopicForLesson(
          nextSub,
          nextEntry.type,
          currentWeek
        )

        return {
          type: 'break',
          label: kk.breakTime,
          sublabel: activeMidtermName,
          nextEntry,
          minutesUntilNext,
          topic: nextTopic,
          periodName: activeMidtermName,
        }
      }
    }
  }

  // After all lessons ended
  return {
    type: 'day_ended',
    label: kk.dayEnded,
    sublabel: activeMidtermName,
    periodName: activeMidtermName,
  }
}
