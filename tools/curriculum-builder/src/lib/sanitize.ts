import type {
  AcadCalendarDoc,
  NamedRange,
  ScheduleDoc,
  ScheduleEntry,
  SubjectDoc,
  Teacher,
} from '../types';

/**
 * Сборка «чистого» документа для экспорта: тримминг строк и удаление
 * опциональных полей-пустышек (pdfs: [], phone: "", name: "", group: null...),
 * чтобы JSON соответствовал схеме максимально аккуратно.
 */

function t(v: string): string {
  return v.trim();
}

export function toExportSubject(doc: SubjectDoc): SubjectDoc {
  const teacher: Teacher = { name: t(doc.teacher.name) };
  const phone = t(doc.teacher.phone ?? '');
  const email = t(doc.teacher.email ?? '');
  if (phone !== '') teacher.phone = phone;
  if (email !== '') teacher.email = email;

  const out: SubjectDoc = {
    subject_id: t(doc.subject_id),
    subject_code: t(doc.subject_code),
    subject_name: t(doc.subject_name),
    course: doc.course,
    semester: doc.semester,
    credits_ects: doc.credits_ects,
    teacher,
    description: t(doc.description),
    topics: doc.topics.map((tp) => ({ type: tp.type, week: tp.week, topic: t(tp.topic) })),
  };
  if (doc.pdfs !== undefined && doc.pdfs.length > 0) {
    out.pdfs = doc.pdfs.map((p) => ({ title: t(p.title), filename: t(p.filename), url: t(p.url) }));
  }
  return out;
}

export function toExportSchedule(doc: ScheduleDoc): ScheduleDoc {
  return {
    course: doc.course,
    semester: doc.semester,
    schedule: doc.schedule.map((e): ScheduleEntry => {
      const out: ScheduleEntry = {
        day: e.day,
        start: e.start,
        end: e.end,
        subject_id: t(e.subject_id),
        subject_name: t(e.subject_name),
        type: e.type ?? null,
        room: e.room === null ? null : t(e.room),
        teacher: e.teacher === null ? null : t(e.teacher),
      };
      const group = t(e.group ?? '');
      const validFrom = t(e.valid_from ?? '');
      if (group !== '') out.group = group;
      if (validFrom !== '') out.valid_from = validFrom;
      return out;
    }),
  };
}

export function toExportAcadCalendar(doc: AcadCalendarDoc): AcadCalendarDoc {
  const named = (r: NamedRange): NamedRange => {
    const out: NamedRange = { start: t(r.start), end: t(r.end) };
    const name = t(r.name ?? '');
    if (name !== '') out.name = name;
    return out;
  };
  return {
    course: doc.course,
    academic_year: t(doc.academic_year),
    semesters: doc.semesters.map((s) => ({
      semester: s.semester,
      semester_start: t(s.semester_start),
      semester_end: t(s.semester_end),
      total_weeks: s.total_weeks,
      orientation_week: { start: t(s.orientation_week.start), end: t(s.orientation_week.end) },
      midterm_controls: s.midterm_controls.map(named),
      exam_period: { start: t(s.exam_period.start), end: t(s.exam_period.end) },
      holidays: s.holidays.map(named),
    })),
    practices: doc.practices.map(named),
    grading_period: { start: t(doc.grading_period.start), end: t(doc.grading_period.end) },
  };
}
