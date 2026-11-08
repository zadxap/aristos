import { useState, useEffect } from 'react'
import type { Subject, Schedule, AcadCalendar, CurrentStatus } from '@/types'
import { getCurrentStatus } from '@/lib/status'

export function useCurrentStatus(
  schedule: Schedule | undefined,
  calendar: AcadCalendar | undefined,
  subjects: Subject[],
  activeSemester = 1
): CurrentStatus {
  const [status, setStatus] = useState<CurrentStatus>(() =>
    getCurrentStatus(new Date(), schedule, calendar, subjects, activeSemester)
  )

  useEffect(() => {
    function update() {
      setStatus(
        getCurrentStatus(
          new Date(),
          schedule,
          calendar,
          subjects,
          activeSemester
        )
      )
    }

    update()
    const timer = setInterval(update, 10000) // update every 10s for responsive progress bar
    return () => clearInterval(timer)
  }, [schedule, calendar, subjects, activeSemester])

  return status
}
