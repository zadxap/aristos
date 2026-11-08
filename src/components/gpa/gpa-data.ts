import type { CanvasCourse, CanvasCourseMap, PlatonusYearRecord, Subject } from '@/types'
import { newGpaRowId, type GpaRow } from './gpa-scale'

/** "Система баз данных (SBD…)" → "системабазданныхsbd…" — for fuzzy matching. */
export function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '')
}

function codeMatches(courseCode: string, subjectCode: string): boolean {
  const course = normalizeKey(courseCode)
  const subject = normalizeKey(subjectCode)
  if (!course || !subject) return false
  return course === subject || (subject.length >= 3 && course.startsWith(subject))
}

function nameMatches(a: string, b: string): boolean {
  const na = normalizeKey(a)
  const nb = normalizeKey(b)
  if (!na || !nb) return false
  return na === nb || (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na)))
}

function round1(value: number): string {
  return String(Math.round(value * 10) / 10)
}

/** Итог предмета из импортированного журнала Платонус: точный код, иначе похожее название. */
function platonusFinalFor(code: string, name: string, records: PlatonusYearRecord[]): number | null {
  const sorted = [...records].sort((a, b) => b.year - a.year || b.term - a.term)
  for (const record of sorted) {
    for (const subject of record.subjects) {
      if (subject.final === null) continue
      const codeMatch = code !== '' && subject.code !== '' && normalizeKey(subject.code) === normalizeKey(code)
      if (codeMatch || nameMatches(name, subject.name)) return subject.final
    }
  }
  return null
}

/** Canvas current_score: точный маппинг курса → код курса → похожее название. */
function canvasScoreFor(
  subjectId: string,
  code: string,
  name: string,
  courses: CanvasCourse[],
  courseMap: CanvasCourseMap
): number | null {
  const byMap = courses.find((course) => courseMap[String(course.id)] === subjectId)
  if (byMap) return byMap.current_score
  const byCode = courses.find((course) => codeMatches(course.code, code))
  if (byCode) return byCode.current_score
  const byName = courses.find((course) => nameMatches(course.name, name))
  if (byName) return byName.current_score
  return null
}

export function emptyGpaRow(): GpaRow {
  return {
    id: newGpaRowId(),
    name: '',
    credits: '',
    percent: '',
    forecast: '',
    include: true,
  }
}

/**
 * Начальные строки калькулятора: предметы активного семестра, кредиты из ECTS,
 * итоговый % — сначала из Платонуса (код/похожее название), затем Canvas current_score,
 * иначе пусто. Без локальных предметов — откат на курсы Canvas, затем одна пустая строка.
 */
export function deriveGpaRows(params: {
  subjects: Subject[]
  activeCourse: number
  activeSemester: number
  platonusYears: PlatonusYearRecord[]
  canvasCourses: CanvasCourse[]
  canvasCourseMap: CanvasCourseMap
}): GpaRow[] {
  const { subjects, activeCourse, activeSemester, platonusYears, canvasCourses, canvasCourseMap } = params
  const rows: GpaRow[] = []

  for (const subject of subjects) {
    if (subject.course !== activeCourse || subject.semester !== activeSemester) continue
    const percent =
      platonusFinalFor(subject.subject_code, subject.subject_name, platonusYears) ??
      canvasScoreFor(subject.subject_id, subject.subject_code, subject.subject_name, canvasCourses, canvasCourseMap)
    rows.push({
      id: `subj-${subject.subject_id}`,
      name: subject.subject_name,
      credits: subject.credits_ects > 0 ? String(subject.credits_ects) : '',
      percent: percent !== null ? round1(percent) : '',
      forecast: '',
      include: true,
    })
  }

  if (rows.length === 0) {
    for (const course of canvasCourses) {
      rows.push({
        id: `canvas-${course.id}`,
        name: course.name,
        credits: '',
        percent: course.current_score !== null ? round1(course.current_score) : '',
        forecast: '',
        include: true,
      })
    }
  }

  if (rows.length === 0) rows.push(emptyGpaRow())
  return rows
}
