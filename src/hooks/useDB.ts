import { useState, useEffect, useCallback } from 'react'
import type { Subject, Schedule, AcadCalendar, CanvasCourse, CanvasAssignment, CanvasCourseMap, CanvasSyncPayload, PlatonusYearRecord, PlatonusSyncPayload } from '@/types'
import {
  getAllSubjects,
  getSubjectById,
  getSchedule,
  getCalendar,
  getAllCalendars,
  getSetting,
  saveSetting,
  saveSubject,
  deleteSubject,
  saveSchedule,
  saveCalendar,
} from '@/lib/db'
import { applyCanvasSync, buildAutoCourseMap, loadCanvasData, saveCanvasCourseMap } from '@/lib/canvas'
import { applyPlatonusSync, loadPlatonusYears } from '@/lib/platonus'
import { restoreBackup } from '@/lib/backup'
import { getCloudConfig, isCloudConfigured, pullFromCloud, pushToCloud } from '@/lib/cloud'

/** Fire-and-forget cloud push after Canvas/Platonus syncs; never blocks or throws. */
async function autoPushToCloud(): Promise<void> {
  try {
    const config = await getCloudConfig()
    if (!isCloudConfigured(config) || !config.autoPush) return
    const result = await pushToCloud(config.endpoint, config.code, config.passphrase)
    if (result.status !== 'ok') console.warn('Cloud auto-push skipped:', result)
  } catch (err) {
    console.warn('Cloud auto-push failed:', err)
  }
}

export function useDB() {
  const [loading, setLoading] = useState(true)
  const [activeCourse, setActiveCourseState] = useState<number>(2)
  const [activeSemester, setActiveSemesterState] = useState<number>(1)
  const [editMode, setEditModeState] = useState<boolean>(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [schedule, setSchedule] = useState<Schedule | undefined>(undefined)
  const [calendar, setCalendar] = useState<AcadCalendar | undefined>(undefined)
  const [calendars, setCalendars] = useState<AcadCalendar[]>([])
  const [canvasCourses, setCanvasCourses] = useState<CanvasCourse[]>([])
  const [canvasAssignments, setCanvasAssignments] = useState<CanvasAssignment[]>([])
  const [canvasLastSync, setCanvasLastSync] = useState<string | null>(null)
  const [canvasCourseMap, setCanvasCourseMap] = useState<CanvasCourseMap>({})
  const [canvasPeriod, setCanvasPeriod] = useState<{ course: number; semester: number } | null>(null)
  const [platonusYears, setPlatonusYears] = useState<PlatonusYearRecord[]>([])
  const [todayKey, setTodayKey] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [refreshIndex, setRefreshIndex] = useState(0)

  // Courses exist if they have subjects, a calendar, Platonus history, or are
  // currently selected — otherwise switching away from a course with no subject
  // JSONs would hide it. Platonus year 2024 = 1st course, 2025 = 2nd, 2026 = 3rd.
  const platonusCourses = platonusYears.map((record) => record.year - 2023)
  const availableCourses = [...new Set([
    ...subjects.map((subject) => subject.course),
    ...calendars.map((cal) => cal.course),
    ...platonusCourses,
    activeCourse,
  ])].sort((a, b) => a - b)
  const availableSemesters = [...new Set([
    ...subjects.filter((subject) => subject.course === activeCourse).map((subject) => subject.semester),
    ...(calendars.find((cal) => cal.course === activeCourse)?.semesters.map((sem) => sem.semester) ?? []),
    activeSemester,
  ])].sort((a, b) => a - b)

  const reloadData = useCallback(() => {
    setRefreshIndex((prev) => prev + 1)
  }, [])

  // Initialize on mount
  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        // Cloud auto-pull BEFORE reading stores, so init picks up restored data.
        try {
          const config = await getCloudConfig()
          if (isCloudConfigured(config) && config.autoPull) {
            const result = await pullFromCloud(config.endpoint, config.code, config.passphrase)
            if (result.status === 'ok') {
              const lastPull = await getSetting<string | null>('cloudLastPull', null)
              if (!lastPull || result.backup.exportedAt > lastPull) {
                await restoreBackup(result.backup)
                await saveSetting('cloudLastPull', result.updatedAt ?? result.backup.exportedAt)
              }
            }
          }
        } catch (err) {
          console.warn('Cloud auto-pull skipped:', err)
        }

        const allSubs = await getAllSubjects()
        const defaultCourse = [...new Set(allSubs.map((subject) => subject.course))].sort((a, b) => a - b)[0] ?? 1
        const defaultSemester = [...new Set(allSubs.filter((subject) => subject.course === defaultCourse).map((subject) => subject.semester))].sort((a, b) => a - b)[0] ?? 1
        const savedCourse = await getSetting<number>('activeCourse', defaultCourse)
        const savedSem = await getSetting<number>('activeSemester', defaultSemester)
        const savedEdit = await getSetting<boolean>('editMode', false)

        if (!mounted) return
        setActiveCourseState(savedCourse)
        setActiveSemesterState(savedSem)
        setEditModeState(savedEdit)

        // Load data
        const sched = await getSchedule(savedCourse, savedSem)
        const cal = await getCalendar(savedCourse)
        const allCalendars = await getAllCalendars()
        const canvas = await loadCanvasData()
        const platonus = await loadPlatonusYears()
        const canvasPeriod = await getSetting<{ course: number; semester: number } | null>('canvasPeriod', null)

        if (!mounted) return
        setSubjects(allSubs)
        setSchedule(sched)
        setCalendar(cal)
        setCalendars(allCalendars)
        setCanvasCourses(canvas.courses)
        setCanvasAssignments(canvas.assignments)
        setCanvasLastSync(canvas.lastSync)
        setCanvasCourseMap(canvas.courseMap)
        setCanvasPeriod(canvasPeriod)
        setPlatonusYears(platonus)
      } catch (err) {
        console.error('Failed to init DB:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()
    return () => {
      mounted = false
    }
  }, [refreshIndex])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date()
      setTodayKey(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // When the system date enters another academic semester, select its own data.
  useEffect(() => {
    if (loading || calendars.length === 0) return
    const context = calendars
      .flatMap((cal) => cal.semesters.map((sem) => ({ course: cal.course, semester: sem.semester, start: sem.semester_start, end: sem.semester_end })))
      .find((sem) => todayKey >= sem.start && todayKey <= sem.end)
    if (!context || (context.course === activeCourse && context.semester === activeSemester)) return

    const timer = window.setTimeout(() => {
      setActiveCourseState(context.course)
      setActiveSemesterState(context.semester)
      void saveSetting('activeCourse', context.course)
      void saveSetting('activeSemester', context.semester)
      void getSchedule(context.course, context.semester).then(setSchedule)
      void getCalendar(context.course).then(setCalendar)
    }, 0)
    return () => window.clearTimeout(timer)
    // Selection changes are intentionally excluded: a manual course choice should remain usable until the date changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, calendars, todayKey])

  // Change active course
  const setActiveCourse = useCallback(
    async (course: number) => {
      const courseSemesters = [...new Set(subjects.filter((subject) => subject.course === course).map((subject) => subject.semester))].sort((a, b) => a - b)
      const nextSemester = courseSemesters.includes(activeSemester) ? activeSemester : (courseSemesters[0] ?? activeSemester)
      setActiveCourseState(course)
      setActiveSemesterState(nextSemester)
      await saveSetting('activeCourse', course)
      await saveSetting('activeSemester', nextSemester)
      const sched = await getSchedule(course, nextSemester)
      const cal = await getCalendar(course)
      setSchedule(sched)
      setCalendar(cal)
    },
    [activeSemester, subjects]
  )

  // Change active semester
  const setActiveSemester = useCallback(
    async (semester: number) => {
      setActiveSemesterState(semester)
      await saveSetting('activeSemester', semester)
      const sched = await getSchedule(activeCourse, semester)
      setSchedule(sched)
    },
    [activeCourse]
  )

  // Toggle edit mode
  const setEditMode = useCallback(async (enabled: boolean) => {
    setEditModeState(enabled)
    await saveSetting('editMode', enabled)
  }, [])

  // Actions for modifying items
  const updateSubject = useCallback(
    async (subject: Subject) => {
      const previous = await getSubjectById(subject.subject_id)
      if (previous && (previous.course !== subject.course || previous.semester !== subject.semester)) {
        const previousSchedule = await getSchedule(previous.course, previous.semester)
        const movedLessons = previousSchedule?.schedule.filter((entry) => entry.subject_id === subject.subject_id) ?? []

        if (previousSchedule && movedLessons.length > 0) {
          const nextSchedule = await getSchedule(subject.course, subject.semester)
          const movedIds = new Set(movedLessons)
          const remainingLessons = previousSchedule.schedule.filter((entry) => !movedIds.has(entry))
          const existingLessons = nextSchedule?.schedule ?? []

          await saveSchedule({ ...previousSchedule, schedule: remainingLessons })
          await saveSchedule({
            course: subject.course,
            semester: subject.semester,
            schedule: [...existingLessons, ...movedLessons],
          })
        }
      }
      await saveSubject(subject)
      reloadData()
    },
    [reloadData]
  )

  const removeSubject = useCallback(
    async (subject_id: string) => {
      await deleteSubject(subject_id)
      reloadData()
    },
    [reloadData]
  )

  const updateSchedule = useCallback(
    async (newSchedule: Schedule) => {
      await saveSchedule(newSchedule)
      reloadData()
    },
    [reloadData]
  )

  const updateCalendar = useCallback(
    async (newCalendar: AcadCalendar) => {
      await saveCalendar(newCalendar)
      reloadData()
    },
    [reloadData]
  )

  // Canvas sync
  const syncCanvas = useCallback(
    async (payload: CanvasSyncPayload) => {
      await applyCanvasSync(payload)
      // Remember which course/semester this Canvas data belongs to, so the
      // grades page can scope it to the switcher selection.
      const period = { course: activeCourse, semester: activeSemester }
      await saveSetting('canvasPeriod', period)
      setCanvasPeriod(period)
      setCanvasCourses(payload.courses)
      setCanvasAssignments(payload.assignments)
      setCanvasLastSync(payload.syncedAt)
      const nextMap = buildAutoCourseMap(payload.courses, subjects, canvasCourseMap)
      setCanvasCourseMap(nextMap)
      await saveCanvasCourseMap(nextMap)
      void autoPushToCloud()
    },
    [subjects, canvasCourseMap, activeCourse, activeSemester]
  )

  const setCourseMapping = useCallback(async (map: CanvasCourseMap) => {
    setCanvasCourseMap(map)
    await saveCanvasCourseMap(map)
  }, [])

  // Platonus journal sync (upsert by year-term)
  const syncPlatonus = useCallback(async (payload: PlatonusSyncPayload) => {
    await applyPlatonusSync(payload)
    setPlatonusYears(await loadPlatonusYears())
    void autoPushToCloud()
  }, [])

  return {
    loading,
    activeCourse,
    availableCourses,
    setActiveCourse,
    activeSemester,
    availableSemesters,
    setActiveSemester,
    editMode,
    setEditMode,
    subjects,
    schedule,
    calendar,
    calendars,
    todayKey,
    reloadData,
    updateSubject,
    removeSubject,
    updateSchedule,
    updateCalendar,
    canvasCourses,
    canvasAssignments,
    canvasLastSync,
    canvasCourseMap,
    canvasPeriod,
    syncCanvas,
    setCourseMapping,
    platonusYears,
    syncPlatonus,
  }
}
