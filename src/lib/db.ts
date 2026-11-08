import { openDB, type IDBPDatabase } from 'idb'
import type { Subject, Schedule, AcadCalendar, CanvasCourse, CanvasAssignment, PlatonusYearRecord } from '@/types'
import type { PdfFileRecord } from './pdf-store'

const DB_NAME = 'aristos_db'
const DB_VERSION = 4

export interface AristosDBSchema {
  subjects: {
    key: string
    value: Subject
  }
  schedules: {
    key: string // "course-semester" e.g. "2-1"
    value: Schedule
  }
  calendars: {
    key: number // course number e.g. 2
    value: AcadCalendar
  }
  settings: {
    key: string
    value: unknown
  }
  canvasCourses: {
    key: number // canvas course id
    value: CanvasCourse
  }
  canvasAssignments: {
    key: number // canvas assignment id
    value: CanvasAssignment
  }
  platonusYears: {
    key: string // "2025-1"
    value: PlatonusYearRecord
  }
  pdfFiles: {
    key: string // "${subject_id}:${filename}"
    value: PdfFileRecord
  }
}

let dbPromise: Promise<IDBPDatabase<AristosDBSchema>> | null = null

export function getDB(): Promise<IDBPDatabase<AristosDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AristosDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('subjects')) {
          db.createObjectStore('subjects', { keyPath: 'subject_id' })
        }
        if (!db.objectStoreNames.contains('schedules')) {
          db.createObjectStore('schedules')
        }
        if (!db.objectStoreNames.contains('calendars')) {
          db.createObjectStore('calendars')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings')
        }
        if (!db.objectStoreNames.contains('canvasCourses')) {
          db.createObjectStore('canvasCourses', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('canvasAssignments')) {
          db.createObjectStore('canvasAssignments', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('platonusYears')) {
          db.createObjectStore('platonusYears', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('pdfFiles')) {
          db.createObjectStore('pdfFiles', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

// Subject operations
export async function getAllSubjects(): Promise<Subject[]> {
  const db = await getDB()
  return db.getAll('subjects')
}

export async function getSubjectById(subject_id: string): Promise<Subject | undefined> {
  const db = await getDB()
  return db.get('subjects', subject_id)
}

export async function saveSubject(subject: Subject): Promise<void> {
  const db = await getDB()
  await db.put('subjects', subject)
}

export async function deleteSubject(subject_id: string): Promise<void> {
  const db = await getDB()
  await db.delete('subjects', subject_id)
}

// Schedule operations
export async function getAllSchedules(): Promise<Schedule[]> {
  const db = await getDB()
  return db.getAll('schedules')
}

export async function getSchedule(course: number, semester: number): Promise<Schedule | undefined> {
  const db = await getDB()
  return db.get('schedules', `${course}-${semester}`)
}

export async function deleteSchedule(course: number, semester: number): Promise<void> {
  const db = await getDB()
  await db.delete('schedules', `${course}-${semester}`)
}

export async function saveSchedule(schedule: Schedule): Promise<void> {
  const db = await getDB()
  await db.put('schedules', schedule, `${schedule.course}-${schedule.semester}`)
}

// Calendar operations
export async function deleteCalendar(course: number): Promise<void> {
  const db = await getDB()
  await db.delete('calendars', course)
}
export async function getCalendar(course: number): Promise<AcadCalendar | undefined> {
  const db = await getDB()
  return db.get('calendars', course)
}

export async function getAllCalendars(): Promise<AcadCalendar[]> {
  const db = await getDB()
  return db.getAll('calendars')
}

export async function saveCalendar(calendar: AcadCalendar): Promise<void> {
  const db = await getDB()
  await db.put('calendars', calendar, calendar.course)
}

// Canvas operations (re-syncable data — replaced wholesale on every sync)
export async function getAllCanvasCourses(): Promise<CanvasCourse[]> {
  const db = await getDB()
  return db.getAll('canvasCourses')
}

export async function getAllCanvasAssignments(): Promise<CanvasAssignment[]> {
  const db = await getDB()
  return db.getAll('canvasAssignments')
}

export async function saveCanvasCourses(courses: CanvasCourse[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('canvasCourses', 'readwrite')
  await Promise.all([...courses.map((course) => tx.store.put(course)), tx.done])
}

export async function saveCanvasAssignments(assignments: CanvasAssignment[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('canvasAssignments', 'readwrite')
  await Promise.all([...assignments.map((item) => tx.store.put(item)), tx.done])
}

export async function clearCanvasData(): Promise<void> {
  const db = await getDB()
  await Promise.all([db.clear('canvasCourses'), db.clear('canvasAssignments')])
}

// Platonus journal operations (upsert per year-term)
export async function getAllPlatonusYears(): Promise<PlatonusYearRecord[]> {
  const db = await getDB()
  return db.getAll('platonusYears')
}

export async function savePlatonusYear(record: PlatonusYearRecord): Promise<void> {
  const db = await getDB()
  await db.put('platonusYears', record)
}

export async function clearPlatonusData(): Promise<void> {
  const db = await getDB()
  await db.clear('platonusYears')
}

// Settings operations
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDB()
  const val = await db.get('settings', key)
  return val !== undefined ? val : defaultValue
}

export async function saveSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDB()
  await db.put('settings', value, key)
}

export async function clearAllData(): Promise<void> {
  const db = await getDB()
  await db.clear('subjects')
  await db.clear('schedules')
  await db.clear('calendars')
  await db.clear('settings')
  await db.clear('canvasCourses')
  await db.clear('canvasAssignments')
  await db.clear('platonusYears')
  // pdfFiles тоже чистим: это локальные блобы юзера (см. pdf-store.ts)
  await db.clear('pdfFiles')
}
