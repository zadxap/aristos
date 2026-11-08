import type {
  AcadCalendarDoc,
  DateRange,
  DocKind,
  LessonType,
  NamedRange,
  PdfLink,
  ScheduleDoc,
  ScheduleEntry,
  SemesterCalendar,
  SubjectDoc,
  Teacher,
  Topic,
} from '../types';
import { t } from './i18n';

/**
 * Строгий структурный парсинг «сырого» JSON (импорт файла или ответ ИИ).
 * Парсер проверяет структуру схемы и возвращает чистый типизированный документ.
 * Небольшая нормализация допускается: "9:00" -> "09:00", "01.09.2026" -> "2026-09-01".
 * Сообщения об ошибках — из i18n-словаря в момент вызова.
 */

export type ParseResult<T> = { ok: true; doc: T } | { ok: false; errors: string[] };

export const TOPIC_TYPES = [
  'lecture',
  'practice',
  'lab',
  'srsp',
  'srs',
  'mini_project',
  'military',
  'other',
] as const;

export const LESSON_TYPES = ['lecture', 'practice'] as const;

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function describe(v: unknown): string {
  if (v === null) return t().parse.kindNull();
  if (Array.isArray(v)) return t().parse.kindArray();
  const ty = typeof v;
  if (ty === 'object') return t().parse.kindObject();
  if (ty === 'string') return JSON.stringify(v);
  if (ty === 'number' || ty === 'boolean') return String(v);
  return ty;
}

function fail(errors: string[], path: string, expected: string, got: unknown): void {
  errors.push(t().parse.fail(path, expected, describe(got)));
}

function readStr(
  errors: string[],
  path: string,
  v: unknown,
  opts: { required?: boolean } = {},
): string {
  if (v === undefined || v === null) {
    if (opts.required === true) fail(errors, path, t().parse.expectedString(), v);
    return '';
  }
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  fail(errors, path, t().parse.expectedString(), v);
  return '';
}

function readNum(errors: string[], path: string, v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  fail(errors, path, t().parse.expectedNumber(), v);
  return 0;
}

function readEnum<T extends string>(
  errors: string[],
  path: string,
  v: unknown,
  allowed: readonly T[],
): T | null {
  if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return v as T;
  fail(errors, path, t().parse.expectedEnum(allowed.join(' | ')), v);
  return null;
}

function readStrOrNull(errors: string[], path: string, v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v === '' ? null : v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  fail(errors, path, t().parse.expectedStringOrNull(), v);
  return null;
}

export function normalizeTime(v: string): string {
  const m = v.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m !== null) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return v.trim();
}

export function normalizeDate(v: string): string {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m !== null) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}

// ---------------------------------------------------------------- Subject

export function parseSubject(raw: unknown): ParseResult<SubjectDoc> {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: [t().parse.rootNotObject()] };

  const subject_id = readStr(errors, 'subject_id', raw.subject_id, { required: true });
  const subject_code = readStr(errors, 'subject_code', raw.subject_code, { required: true });
  const subject_name = readStr(errors, 'subject_name', raw.subject_name, { required: true });
  const course = readNum(errors, 'course', raw.course);
  const semester = readNum(errors, 'semester', raw.semester);
  const credits_ects = readNum(errors, 'credits_ects', raw.credits_ects);
  const description = readStr(errors, 'description', raw.description, { required: true });

  let teacher: Teacher = { name: '' };
  if (isRecord(raw.teacher)) {
    teacher = { name: readStr(errors, 'teacher.name', raw.teacher.name, { required: true }) };
    const phone = readStrOrNull(errors, 'teacher.phone', raw.teacher.phone);
    const email = readStrOrNull(errors, 'teacher.email', raw.teacher.email);
    if (phone !== null) teacher.phone = phone;
    if (email !== null) teacher.email = email;
  } else if (raw.teacher === undefined) {
    errors.push(t().parse.teacherMissing());
  } else {
    fail(errors, 'teacher', t().parse.expectedTeacher(), raw.teacher);
  }

  const topics: Topic[] = [];
  if (Array.isArray(raw.topics)) {
    raw.topics.forEach((item, i) => {
      if (!isRecord(item)) {
        fail(errors, `topics[${i}]`, t().parse.expectedTopic(), item);
        return;
      }
      const type = readEnum(errors, `topics[${i}].type`, item.type, TOPIC_TYPES);
      const week = readNum(errors, `topics[${i}].week`, item.week);
      const topic = readStr(errors, `topics[${i}].topic`, item.topic, { required: true });
      topics.push({ type: type ?? 'other', week, topic });
    });
  } else {
    fail(errors, 'topics', t().parse.expectedArray(), raw.topics);
  }

  let pdfs: PdfLink[] | undefined;
  if (raw.pdfs !== undefined && raw.pdfs !== null) {
    if (Array.isArray(raw.pdfs)) {
      const list: PdfLink[] = [];
      raw.pdfs.forEach((item, i) => {
        if (!isRecord(item)) {
          fail(errors, `pdfs[${i}]`, t().parse.expectedPdf(), item);
          return;
        }
        list.push({
          title: readStr(errors, `pdfs[${i}].title`, item.title, { required: true }),
          filename: readStr(errors, `pdfs[${i}].filename`, item.filename, { required: true }),
          url: readStr(errors, `pdfs[${i}].url`, item.url, { required: true }),
        });
      });
      pdfs = list;
    } else {
      fail(errors, 'pdfs', t().parse.expectedArray(), raw.pdfs);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  const doc: SubjectDoc = {
    subject_id,
    subject_code,
    subject_name,
    course,
    semester,
    credits_ects,
    teacher,
    description,
    topics,
  };
  if (pdfs !== undefined && pdfs.length > 0) doc.pdfs = pdfs;
  return { ok: true, doc };
}

// ---------------------------------------------------------------- Schedule

export function parseSchedule(raw: unknown): ParseResult<ScheduleDoc> {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: [t().parse.rootNotObject()] };

  const course = readNum(errors, 'course', raw.course);
  const semester = readNum(errors, 'semester', raw.semester);

  const schedule: ScheduleEntry[] = [];
  if (Array.isArray(raw.schedule)) {
    raw.schedule.forEach((item, i) => {
      if (!isRecord(item)) {
        fail(errors, `schedule[${i}]`, t().parse.expectedEntry(), item);
        return;
      }
      const p = `schedule[${i}]`;
      const day = readEnum(errors, `${p}.day`, item.day, DAYS);
      const startRaw = readStr(errors, `${p}.start`, item.start, { required: true });
      const endRaw = readStr(errors, `${p}.end`, item.end, { required: true });
      const subject_id = readStr(errors, `${p}.subject_id`, item.subject_id, { required: true });
      const subject_name = readStr(errors, `${p}.subject_name`, item.subject_name, { required: true });

      let type: LessonType | null = null;
      if (item.type !== undefined && item.type !== null && item.type !== '') {
        type = readEnum(errors, `${p}.type`, item.type, LESSON_TYPES);
      }

      const room = readStrOrNull(errors, `${p}.room`, item.room);
      const teacher = readStrOrNull(errors, `${p}.teacher`, item.teacher);
      const group = readStrOrNull(errors, `${p}.group`, item.group);
      let valid_from: string | null = null;
      if (typeof item.valid_from === 'string' && item.valid_from.trim() !== '') {
        valid_from = normalizeDate(item.valid_from);
      } else if (item.valid_from !== undefined && item.valid_from !== null) {
        valid_from = readStrOrNull(errors, `${p}.valid_from`, item.valid_from);
      }

      schedule.push({
        day: day ?? 'mon',
        start: startRaw === '' ? '' : normalizeTime(startRaw),
        end: endRaw === '' ? '' : normalizeTime(endRaw),
        subject_id,
        subject_name,
        type,
        room,
        teacher,
        group,
        valid_from,
      });
    });
  } else {
    fail(errors, 'schedule', t().parse.expectedArray(), raw.schedule);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, doc: { course, semester, schedule } };
}

// ---------------------------------------------------------------- AcadCalendar

function readRange(errors: string[], path: string, v: unknown): DateRange {
  if (!isRecord(v)) {
    fail(errors, path, t().parse.expectedRange(), v);
    return { start: '', end: '' };
  }
  const startRaw = readStr(errors, `${path}.start`, v.start, { required: true });
  const endRaw = readStr(errors, `${path}.end`, v.end, { required: true });
  return {
    start: startRaw === '' ? '' : normalizeDate(startRaw),
    end: endRaw === '' ? '' : normalizeDate(endRaw),
  };
}

function readNamedRanges(errors: string[], path: string, v: unknown): NamedRange[] {
  if (!Array.isArray(v)) {
    fail(errors, path, t().parse.expectedNamedRanges(), v);
    return [];
  }
  const out: NamedRange[] = [];
  v.forEach((item, i) => {
    if (!isRecord(item)) {
      fail(errors, `${path}[${i}]`, t().parse.expectedNamedRanges(), item);
      return;
    }
    const p = `${path}[${i}]`;
    const startRaw = readStr(errors, `${p}.start`, item.start, { required: true });
    const endRaw = readStr(errors, `${p}.end`, item.end, { required: true });
    const range: NamedRange = {
      start: startRaw === '' ? '' : normalizeDate(startRaw),
      end: endRaw === '' ? '' : normalizeDate(endRaw),
    };
    if (typeof item.name === 'string' && item.name.trim() !== '') range.name = item.name;
    out.push(range);
  });
  return out;
}

export function parseAcadCalendar(raw: unknown): ParseResult<AcadCalendarDoc> {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: [t().parse.rootNotObject()] };

  const course = readNum(errors, 'course', raw.course);
  const academic_year = readStr(errors, 'academic_year', raw.academic_year, { required: true });

  const semesters: SemesterCalendar[] = [];
  if (Array.isArray(raw.semesters)) {
    raw.semesters.forEach((item, i) => {
      if (!isRecord(item)) {
        fail(errors, `semesters[${i}]`, t().parse.expectedSemester(), item);
        return;
      }
      const p = `semesters[${i}]`;
      const startRaw = readStr(errors, `${p}.semester_start`, item.semester_start, { required: true });
      const endRaw = readStr(errors, `${p}.semester_end`, item.semester_end, { required: true });
      semesters.push({
        semester: readNum(errors, `${p}.semester`, item.semester),
        semester_start: startRaw === '' ? '' : normalizeDate(startRaw),
        semester_end: endRaw === '' ? '' : normalizeDate(endRaw),
        total_weeks: readNum(errors, `${p}.total_weeks`, item.total_weeks),
        orientation_week: readRange(errors, `${p}.orientation_week`, item.orientation_week),
        midterm_controls: readNamedRanges(errors, `${p}.midterm_controls`, item.midterm_controls),
        exam_period: readRange(errors, `${p}.exam_period`, item.exam_period),
        holidays: readNamedRanges(errors, `${p}.holidays`, item.holidays),
      });
    });
  } else {
    fail(errors, 'semesters', t().parse.expectedArray(), raw.semesters);
  }

  const practices = readNamedRanges(errors, 'practices', raw.practices);
  const grading_period = readRange(errors, 'grading_period', raw.grading_period);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, doc: { course, academic_year, semesters, practices, grading_period } };
}

// ---------------------------------------------------------------- Общее

/** Определяет, какому из трёх документов соответствует JSON (для импорта). */
export function detectKind(raw: unknown): DocKind | null {
  if (parseSubject(raw).ok) return 'subject';
  if (parseSchedule(raw).ok) return 'schedule';
  if (parseAcadCalendar(raw).ok) return 'calendar';
  return null;
}

// ---------------------------------------------------------------- Бекап Aristos

/** Содержимое полного бекапа Aristos после мягкого разбора. */
export interface AristosBackup {
  subjects: SubjectDoc[];
  schedules: ScheduleDoc[];
  calendars: AcadCalendarDoc[];
  /** Элементы, не прошедшие проверку схемы. */
  skipped: number;
}

/** Похож ли JSON на полный бекап Aristos: { format: 'aristos-backup', ... }. */
export function isBackupDocument(raw: unknown): boolean {
  return isRecord(raw) && raw.format === 'aristos-backup';
}

/**
 * Мягкий разбор полного бекапа Aristos:
 * { format: 'aristos-backup', version: 1|2, subjects: [], schedules: [], calendars: [], settings: [] }.
 * Каждый элемент массивов проверяется отдельно: невалидные пропускаются
 * и считаются в skipped — вся пачка не отбрасывается. Поле settings игнорируется.
 */
export function parseBackup(raw: unknown): ParseResult<AristosBackup> {
  if (!isRecord(raw)) return { ok: false, errors: [t().parse.rootNotObject()] };
  if (raw.format !== 'aristos-backup') {
    return { ok: false, errors: [t().parse.backupFormat(describe(raw.format))] };
  }
  if (!Array.isArray(raw.subjects) && !Array.isArray(raw.schedules) && !Array.isArray(raw.calendars)) {
    return {
      ok: false,
      errors: [t().parse.backupArrays()],
    };
  }

  let skipped = 0;
  const subjects: SubjectDoc[] = [];
  const schedules: ScheduleDoc[] = [];
  const calendars: AcadCalendarDoc[] = [];

  if (Array.isArray(raw.subjects)) {
    for (const item of raw.subjects) {
      const r = parseSubject(item);
      if (r.ok) subjects.push(r.doc);
      else skipped += 1;
    }
  }
  if (Array.isArray(raw.schedules)) {
    for (const item of raw.schedules) {
      const r = parseSchedule(item);
      if (r.ok) schedules.push(r.doc);
      else skipped += 1;
    }
  }
  if (Array.isArray(raw.calendars)) {
    for (const item of raw.calendars) {
      const r = parseAcadCalendar(item);
      if (r.ok) calendars.push(r.doc);
      else skipped += 1;
    }
  }

  return { ok: true, doc: { subjects, schedules, calendars, skipped } };
}
