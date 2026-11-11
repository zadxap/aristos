export interface Teacher {
  name: string
  phone?: string
  email?: string
}

export interface Topic {
  type: string // lecture, practice, lab, srsp, srs, mini_project, etc.
  week: number
  topic: string
}

export interface SubjectPdf {
  title: string
  filename: string
  url: string
}

export interface Subject {
  subject_id: string
  subject_code: string
  subject_name: string
  course: number
  semester: number
  credits_ects: number
  teacher: Teacher
  description: string
  topics: Topic[]
  /** Optional subject-specific materials, loaded from the subject JSON. */
  pdfs?: SubjectPdf[]
}

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface ScheduleEntry {
  day: DayOfWeek
  start: string // "09:00"
  end: string   // "09:50"
  subject_id: string
  subject_name: string
  type: string | null // "lecture" | "practice" | null
  room: string | null
  teacher: string | null
  group?: string | null
  valid_from?: string | null
}

export interface Schedule {
  course: number
  semester: number
  schedule: ScheduleEntry[]
}

export interface DateRange {
  name?: string
  start: string // "YYYY-MM-DD"
  end: string   // "YYYY-MM-DD"
}

export interface SemesterCalendar {
  semester: number
  semester_start: string
  semester_end: string
  total_weeks: number
  orientation_week: { start: string; end: string }
  midterm_controls: DateRange[]
  exam_period: { start: string; end: string }
  holidays: DateRange[]
}

export interface AcadCalendar {
  course: number
  academic_year: string
  semesters: SemesterCalendar[]
  practices: DateRange[]
  grading_period: { start: string; end: string }
}

export interface AppSettings {
  activeCourse: number
  activeSemester: number
  editMode: boolean
}

export type StatusType =
  | 'holiday'       // Демалыс / каникулы
  | 'exam'          // Сессия
  | 'midterm'       // Рубеждік бақылау
  | 'practice'      // Практика
  | 'before_start'  // Күн басталмады, келесі сабаққа дейін
  | 'in_class'      // Сабақ жүріп жатыр
  | 'break'         // Үзіліс
  | 'day_ended'     // Сабақтар аяқталды
  | 'free_day'      // Бос күн

export interface CurrentStatus {
  type: StatusType
  label: string
  sublabel?: string
  entry?: ScheduleEntry
  topic?: string
  minutesLeft?: number
  progress?: number // 0 to 1
  nextEntry?: ScheduleEntry
  minutesUntilNext?: number
  periodName?: string
}

// Canvas LMS sync (deadlines & grades)

export interface CanvasCourse {
  id: number
  name: string // "Система баз данных (SBD 113242-1-L)"
  code: string // "SBD 113242-1-L" — extracted from the name or course_code
  current_score: number | null // e.g. 92.95
  current_grade: string | null // letter grade, if the course uses a grading scheme
}

export type CanvasItemType = 'assignment' | 'quiz' | 'discussion' | 'other'

export interface CanvasAssignment {
  id: number
  course_id: number
  title: string
  type: CanvasItemType
  due_at: string | null // ISO 8601 — «Срок»
  lock_at: string | null // ISO 8601 — «Доступно до»; фолбэк-дедлайн, когда Срока нет
  points_possible: number
  html_url: string
  submitted_at: string | null
  score: number | null
  graded: boolean
  late: boolean
  missing: boolean
}

export interface CanvasSyncPayload {
  format: 'aristos-canvas-sync'
  version: 1
  syncedAt: string
  source: 'userscript' | 'extension' | 'file' | 'app'
  courses: CanvasCourse[]
  assignments: CanvasAssignment[]
}

/** canvas course id -> local subject_id (null = intentionally unmapped) */
export type CanvasCourseMap = Record<string, string | null>

// Platonus journal sync (historical grades, courses 1-2)

export interface PlatonusMark {
  code: string // discipline code, e.g. "FIL 2102-38-L"
  kind: 'lecture' | 'practice' | 'srsp' | 'other'
  date: string // "YYYY-MM-DD"
  mark: number
}

export interface PlatonusSubject {
  name: string
  code: string
  teacher: string | null
  final: number | null // donut %
  srTek1: number | null
  rk1: number | null
  srTek2: number | null
  rk2: number | null
  rating: number | null
  exam: number | null
  marks: PlatonusMark[]
}

export interface PlatonusYearRecord {
  id: string // "2025-1"
  year: number
  term: number // 1, 2, -1, -2
  syncedAt: string
  subjects: PlatonusSubject[]
}

export interface PlatonusSyncPayload {
  format: 'aristos-platonus-sync'
  version: 1
  syncedAt: string
  records: PlatonusYearRecord[]
}
