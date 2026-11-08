import type {
  AcadCalendarDoc,
  NamedRange,
  ScheduleDoc,
  ScheduleEntry,
  SemesterCalendar,
  SubjectDoc,
  Topic,
} from '../types';

/** Дефолтные пустые документы для новых редакторов. */

export function emptyTopic(week: number): Topic {
  return { type: 'lecture', week, topic: '' };
}

export function emptySubject(): SubjectDoc {
  return {
    subject_id: '',
    subject_code: '',
    subject_name: '',
    course: 1,
    semester: 1,
    credits_ects: 5,
    teacher: { name: '' },
    description: '',
    topics: [],
  };
}

export function emptyScheduleEntry(): ScheduleEntry {
  return {
    day: 'mon',
    start: '09:00',
    end: '09:50',
    subject_id: '',
    subject_name: '',
    type: null,
    room: null,
    teacher: null,
    group: null,
    valid_from: null,
  };
}

export function emptySchedule(): ScheduleDoc {
  return { course: 1, semester: 1, schedule: [] };
}

export function emptyNamedRange(): NamedRange {
  return { start: '', end: '' };
}

export function emptySemester(semester: number): SemesterCalendar {
  return {
    semester,
    semester_start: '',
    semester_end: '',
    total_weeks: 15,
    orientation_week: { start: '', end: '' },
    midterm_controls: [],
    exam_period: { start: '', end: '' },
    holidays: [],
  };
}

export function emptyAcadCalendar(): AcadCalendarDoc {
  return {
    course: 1,
    academic_year: '',
    semesters: [emptySemester(1)],
    practices: [],
    grading_period: { start: '', end: '' },
  };
}
