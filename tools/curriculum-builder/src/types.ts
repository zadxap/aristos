/**
 * Форматы данных дашборда Aristos.
 * Эти типы — источник истины: валидаторы, парсеры и редакторы работают строго по ним.
 */

export type DocKind = 'subject' | 'schedule' | 'calendar';

export type TopicType =
  | 'lecture'
  | 'practice'
  | 'lab'
  | 'srsp'
  | 'srs'
  | 'mini_project'
  | 'military'
  | 'other';

export type LessonType = 'lecture' | 'practice';

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Teacher {
  name: string;
  phone?: string;
  email?: string;
}

export interface Topic {
  type: TopicType;
  week: number;
  topic: string;
}

export interface PdfLink {
  title: string;
  filename: string;
  url: string;
}

/** Файл `<subject_id>.json` */
export interface SubjectDoc {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  course: number;
  semester: number;
  credits_ects: number;
  teacher: Teacher;
  description: string;
  topics: Topic[];
  pdfs?: PdfLink[];
}

/** Файл `schedule.json` */
export interface ScheduleEntry {
  day: DayOfWeek;
  start: string;
  end: string;
  subject_id: string;
  subject_name: string;
  type: LessonType | null;
  room: string | null;
  teacher: string | null;
  group?: string | null;
  valid_from?: string | null;
}

export interface ScheduleDoc {
  course: number;
  semester: number;
  schedule: ScheduleEntry[];
}

export interface DateRange {
  start: string;
  end: string;
}

export interface NamedRange {
  name?: string;
  start: string;
  end: string;
}

export interface SemesterCalendar {
  semester: number;
  semester_start: string;
  semester_end: string;
  total_weeks: number;
  orientation_week: DateRange;
  midterm_controls: NamedRange[];
  exam_period: DateRange;
  holidays: NamedRange[];
}

/** Файл `acad_calendar.json` */
export interface AcadCalendarDoc {
  course: number;
  academic_year: string;
  semesters: SemesterCalendar[];
  practices: NamedRange[];
  grading_period: DateRange;
}
