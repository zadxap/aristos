import type { AcadCalendar, CanvasAssignment, CanvasCourse, PlatonusYearRecord, Subject } from '@/types'
import { computeCourseGrades, titleWeekNumber } from '@/lib/grade-scheme'

export interface AdvisorContextInput {
  activeCourse: number
  activeSemester: number
  canvasCourses: CanvasCourse[]
  canvasAssignments: CanvasAssignment[]
  platonusYears: PlatonusYearRecord[]
  subjects: Subject[]
  calendar?: AcadCalendar
}

/** Compact text summary of the student's situation for the AI advisor. */
export function buildAdvisorContext(input: AdvisorContextInput): string {
  const lines: string[] = []
  const { activeCourse, activeSemester, canvasCourses, canvasAssignments, platonusYears, subjects, calendar } = input

  lines.push(`Студент: ${activeCourse}-курс, ${activeSemester}-семестр`)

  // Canvas courses with РК breakdown
  const semester = calendar?.semesters?.find((s) => s.semester === activeSemester)
  if (canvasCourses.length > 0) {
    lines.push('\n## Текущие курсы (Canvas):')
    for (const course of canvasCourses) {
      const breakdown = computeCourseGrades(course, canvasAssignments, semester)
      const parts = [`РК1: ${breakdown.rk1 !== null ? breakdown.rk1.toFixed(1) : '—'}`]
      parts.push(`РК2: ${breakdown.rk2 !== null ? breakdown.rk2.toFixed(1) : '—'}`)
      if (breakdown.rating !== null) parts.push(`Рейтинг: ${breakdown.rating.toFixed(1)}`)
      if (breakdown.exam !== null) parts.push(`Экз: ${breakdown.exam.toFixed(0)}`)
      if (course.current_score !== null) parts.push(`Canvas: ${course.current_score}%`)
      lines.push(`- ${course.name} — ${parts.join(', ')}`)
    }
  }

  // Individual graded/missing works — so the AI can point at EXACT low scores
  const workLines: string[] = []
  for (const course of canvasCourses) {
    const works = canvasAssignments
      .filter((a) => a.course_id === course.id && (a.graded || a.missing))
      .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
    if (works.length === 0) continue
    workLines.push(`- ${course.code}:`)
    for (const item of works) {
      const week = titleWeekNumber(item.title)
      const weekLabel = week !== null ? `${week}-апта ` : ''
      const mark = item.graded ? `${item.score ?? 0}/${item.points_possible}` : 'нет сдачи'
      const flag = item.missing && !item.graded ? ' (ПРОПУЩЕНО)' : ''
      workLines.push(`  - ${weekLabel}${item.title}: ${mark}${flag}`)
    }
  }
  if (workLines.length > 0) {
    lines.push('\n## Оценки по работам (конкретика для анализа слабых мест):')
    lines.push(...workLines)
  }

  // Upcoming deadlines (nearest 10)
  const now = Date.now()
  const upcoming = canvasAssignments
    .filter((a) => a.due_at && new Date(a.due_at).getTime() >= now && !a.graded)
    .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
    .slice(0, 10)
  if (upcoming.length > 0) {
    lines.push('\n## Ближайшие дедлайны:')
    for (const item of upcoming) {
      const course = canvasCourses.find((c) => c.id === item.course_id)
      lines.push(`- ${new Date(item.due_at!).toLocaleDateString('ru-RU')} — ${item.title} (${course?.code ?? '?'}, ${item.points_possible} балл.)`)
    }
  }

  // Overdue & missing counts
  const missing = canvasAssignments.filter((a) => a.missing && !a.graded).length
  const overdue = canvasAssignments.filter((a) => a.due_at && new Date(a.due_at) < new Date() && !a.graded && !a.submitted_at).length
  if (missing > 0 || overdue > 0) {
    lines.push(`\n## Проблемы: пропущено (missing): ${missing}, просрочено без сдачи: ${overdue}`)
  }

  // Platonus history
  if (platonusYears.length > 0) {
    lines.push('\n## История (Платонус):')
    for (const record of platonusYears) {
      for (const s of record.subjects) {
        lines.push(`- ${record.year}/${record.term} ${s.name}: итог ${s.final !== null ? s.final + '%' : '—'}, рейтинг ${s.rating !== null ? s.rating : '—'}, экз ${s.exam !== null ? s.exam : '—'}`)
      }
    }

    // Оценки по дням — конкретика за прошлые курсы (формат ДД.ММ=балл).
    const markLines: string[] = []
    for (const record of platonusYears) {
      for (const s of record.subjects) {
        if (!s.marks || s.marks.length === 0) continue
        const byCode = new Map<string, typeof s.marks>()
        for (const m of s.marks) {
          if (!byCode.has(m.code)) byCode.set(m.code, [])
          byCode.get(m.code)!.push(m)
        }
        markLines.push(`- ${record.year}/${record.term} ${s.name}:`)
        for (const [code, items] of byCode) {
          const compact = items
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((m) => `${m.date.slice(8, 10)}.${m.date.slice(5, 7)}=${m.mark}`)
            .join(' ')
          markLines.push(`  ${code}: ${compact}`)
        }
      }
    }
    if (markLines.length > 0) {
      lines.push('\n## Оценки по дням за прошлые курсы (Платонус, ДД.ММ=балл, 0 — пропуск/неоценённый день):')
      lines.push(...markLines)
    }
  }

  // Local subjects with credits
  const relevant = subjects.filter((s) => s.course === activeCourse && s.semester === activeSemester)
  if (relevant.length > 0) {
    lines.push(`\n## Предметы семестра (кредиты): ${relevant.map((s) => `${s.subject_name} (${s.credits_ects})`).join(', ')}`)
  }

  const text = lines.join('\n')
  // 30k символов — с запасом: полный список работ + история Платонуса с оценками
  // по дням помещаются, а flash-модели легко переваривают такой объём.
  return text.length > 30000 ? text.slice(0, 30000) + '\n... (обрезано)' : text
}
