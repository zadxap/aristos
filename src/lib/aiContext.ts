import type { AcadCalendar, CanvasAssignment, CanvasCourse, DayOfWeek, PlatonusYearRecord, Schedule, Subject } from '@/types'
import { assignmentWeek, computeCourseGrades } from '@/lib/grade-scheme'
import { effectiveDeadline } from '@/lib/canvas'
import { getAcademicWeek } from '@/lib/academic-week'

export interface AdvisorContextInput {
  activeCourse: number
  activeSemester: number
  canvasCourses: CanvasCourse[]
  canvasAssignments: CanvasAssignment[]
  platonusYears: PlatonusYearRecord[]
  subjects: Subject[]
  calendar?: AcadCalendar
  /** Расписание активного курса/семестра — для «какой сейчас урок» */
  schedule?: Schedule
}

const DAY_KEYS: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** Compact text summary of the student's situation for the AI advisor. */
export function buildAdvisorContext(input: AdvisorContextInput): string {
  const lines: string[] = []
  const { activeCourse, activeSemester, canvasCourses, canvasAssignments, platonusYears, subjects, calendar, schedule } = input

  lines.push(`Студент: ${activeCourse}-курс, ${activeSemester}-семестр`)

  const semester = calendar?.semesters?.find((s) => s.semester === activeSemester)
  const nowDate = new Date()
  if (semester) {
    lines.push(`Учебная неделя: ${getAcademicWeek(nowDate, semester.semester_start, semester.total_weeks)} из ${semester.total_weeks}`)
  }

  // Расписание на сегодня и завтра — без этого модель отвечала «данных нет»
  // на «какой сейчас урок» и выдумывала расписание
  if (schedule?.schedule?.length) {
    const fmtDay = (offsetDays: number, label: string) => {
      const d = new Date(nowDate)
      d.setDate(d.getDate() + offsetDays)
      const dayKey = DAY_KEYS[d.getDay()]
      const lessons = schedule.schedule
        .filter((e) => e.day === dayKey)
        .sort((a, b) => a.start.localeCompare(b.start))
      lines.push(`\n## ${label} (${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}):`)
      if (lessons.length === 0) {
        lines.push('- пар нет')
        return
      }
      for (const e of lessons) {
        const subj = subjects.find((s) => s.subject_id === e.subject_id)
        lines.push(
          `- ${e.start}–${e.end} ${subj?.subject_name ?? e.subject_name}` +
            (e.type ? ` (${e.type})` : '') +
            (e.room ? `, ауд. ${e.room}` : '')
        )
      }
    }
    fmtDay(0, 'Расписание на сегодня')
    fmtDay(1, 'Расписание на завтра')
  }

  // Canvas courses with РК breakdown
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
  // неделя работы — общий assignmentWeek (календарная неделя дедлайна,
  // номер из названия только без даты: «БӨЖ №1» с «Доступно до 27.09» = 4-апта)
  const workLines: string[] = []
  for (const course of canvasCourses) {
    const works = canvasAssignments
      .filter((a) => a.course_id === course.id && (a.graded || a.missing))
      .sort((a, b) => (effectiveDeadline(a) ?? '').localeCompare(effectiveDeadline(b) ?? ''))
    if (works.length === 0) continue
    workLines.push(`- ${course.code}:`)
    for (const item of works) {
      const week = assignmentWeek(item, semester)
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
    .filter((a) => effectiveDeadline(a) && new Date(effectiveDeadline(a)!).getTime() >= now && !a.graded)
    .sort((a, b) => (effectiveDeadline(a) ?? '').localeCompare(effectiveDeadline(b) ?? ''))
    .slice(0, 10)
  if (upcoming.length > 0) {
    lines.push('\n## Ближайшие дедлайны:')
    for (const item of upcoming) {
      const course = canvasCourses.find((c) => c.id === item.course_id)
      lines.push(`- ${new Date(effectiveDeadline(item)!).toLocaleDateString('ru-RU')} — ${item.title} (${course?.code ?? '?'}, ${item.points_possible} балл.)`)
    }
  }

  // Overdue & missing counts
  const missing = canvasAssignments.filter((a) => a.missing && !a.graded).length
  const overdue = canvasAssignments.filter((a) => {
    const due = effectiveDeadline(a)
    return due && new Date(due) < new Date() && !a.graded && !a.submitted_at
  }).length
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

  // Темы текущей недели из программ предметов (subjects[].topics)
  if (semester) {
    const weekNum = getAcademicWeek(nowDate, semester.semester_start, semester.total_weeks)
    const topicLines: string[] = []
    for (const s of relevant) {
      for (const t of s.topics ?? []) {
        if (t.week === weekNum) {
          topicLines.push(`- ${s.subject_name} — ${t.topic}${t.type ? ` (${t.type})` : ''}`)
        }
      }
    }
    if (topicLines.length > 0) {
      lines.push(`\n## Темы недели ${weekNum}:`)
      lines.push(...topicLines)
    }
  }

  const text = lines.join('\n')
  // 30k символов — с запасом: полный список работ + история Платонуса с оценками
  // по дням помещаются, а flash-модели легко переваривают такой объём.
  return text.length > 30000 ? text.slice(0, 30000) + '\n... (обрезано)' : text
}
