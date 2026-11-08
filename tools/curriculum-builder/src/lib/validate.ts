import type { AcadCalendarDoc, NamedRange, ScheduleDoc, SubjectDoc } from '../types';
import { t } from './i18n';

/**
 * Контентная валидация ПЕРЕД экспортом: документ уже структурно корректен
 * (его собирает редактор или структурный парсер), здесь проверяются
 * заполненность обязательных полей и форматы (слаг, HH:MM, YYYY-MM-DD, порядок дат).
 * Сообщения берутся из i18n-словаря в момент вызова (язык текущего UI).
 */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;
const YEAR_RE = /^\d{4}-\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRealDate(s: string): boolean {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m === null) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

function reqStr(list: string[], path: string, value: string): void {
  if (value.trim() === '') list.push(t().validate.required(path));
}

function checkPosNum(list: string[], path: string, value: number, min: number): void {
  if (!Number.isFinite(value) || value < min) {
    list.push(t().validate.posNum(path, min));
  }
}

function checkPosInt(list: string[], path: string, value: number, min: number): void {
  if (!Number.isInteger(value) || value < min) {
    list.push(t().validate.posInt(path, min));
  }
}

/** @returns true, если дата валидна */
function checkDate(list: string[], path: string, value: string, optional = false): boolean {
  const v = value.trim();
  if (v === '') {
    if (!optional) list.push(t().validate.dateMissing(path));
    return false;
  }
  if (!DATE_RE.test(v) || !isRealDate(v)) {
    list.push(t().validate.dateBad(path, v));
    return false;
  }
  return true;
}

/** @returns true, если время валидно */
function checkTime(list: string[], path: string, value: string): boolean {
  const v = value.trim();
  if (v === '') {
    list.push(t().validate.timeMissing(path));
    return false;
  }
  if (!TIME_RE.test(v)) {
    list.push(t().validate.timeBad(path, v));
    return false;
  }
  return true;
}

function checkTimeRange(list: string[], path: string, start: string, end: string): void {
  const okS = checkTime(list, `${path}.start`, start);
  const okE = checkTime(list, `${path}.end`, end);
  if (okS && okE && end <= start) {
    list.push(t().validate.timeOrder(path, end, start));
  }
}

function checkDateRange(list: string[], path: string, start: string, end: string): void {
  const okS = checkDate(list, `${path}.start`, start);
  const okE = checkDate(list, `${path}.end`, end);
  if (okS && okE && end < start) {
    list.push(t().validate.dateOrder(path, end, start));
  }
}

function checkNamedRange(list: string[], path: string, r: NamedRange): void {
  checkDateRange(list, path, r.start, r.end);
}

// ---------------------------------------------------------------- Subject

export function validateSubject(doc: SubjectDoc): string[] {
  const list: string[] = [];
  const sid = doc.subject_id.trim();
  reqStr(list, 'subject_id', sid);
  if (sid !== '' && !SLUG_RE.test(sid)) {
    list.push(t().validate.slug());
  }
  reqStr(list, 'subject_code', doc.subject_code);
  reqStr(list, 'subject_name', doc.subject_name);
  checkPosInt(list, 'course', doc.course, 1);
  checkPosInt(list, 'semester', doc.semester, 1);
  checkPosNum(list, 'credits_ects', doc.credits_ects, 1);
  reqStr(list, 'teacher.name', doc.teacher.name);
  const email = doc.teacher.email?.trim() ?? '';
  if (email !== '' && !EMAIL_RE.test(email)) {
    list.push(t().validate.email());
  }
  reqStr(list, 'description', doc.description);

  if (doc.topics.length === 0) list.push(t().validate.topicsEmpty());
  doc.topics.forEach((tp, i) => {
    checkPosInt(list, `topics[${i}].week`, tp.week, 1);
    reqStr(list, `topics[${i}].topic`, tp.topic);
  });

  doc.pdfs?.forEach((p, i) => {
    reqStr(list, `pdfs[${i}].title`, p.title);
    reqStr(list, `pdfs[${i}].filename`, p.filename);
    reqStr(list, `pdfs[${i}].url`, p.url);
    const url = p.url.trim();
    if (url !== '' && !/^https?:\/\//i.test(url)) {
      list.push(t().validate.urlHttp(`pdfs[${i}].url`));
    }
  });

  return list;
}

// ---------------------------------------------------------------- Schedule

export function validateSchedule(doc: ScheduleDoc): string[] {
  const list: string[] = [];
  checkPosInt(list, 'course', doc.course, 1);
  checkPosInt(list, 'semester', doc.semester, 1);

  if (doc.schedule.length === 0) list.push(t().validate.scheduleEmpty());
  doc.schedule.forEach((e, i) => {
    const p = `schedule[${i}]`;
    checkTimeRange(list, p, e.start, e.end);
    reqStr(list, `${p}.subject_id`, e.subject_id);
    reqStr(list, `${p}.subject_name`, e.subject_name);
    if (e.valid_from !== null && e.valid_from !== undefined && e.valid_from !== '') {
      checkDate(list, `${p}.valid_from`, e.valid_from);
    }
  });

  return list;
}

// ---------------------------------------------------------------- AcadCalendar

export function validateAcadCalendar(doc: AcadCalendarDoc): string[] {
  const list: string[] = [];
  checkPosInt(list, 'course', doc.course, 1);

  const ay = doc.academic_year.trim();
  if (ay === '') {
    list.push(t().validate.yearMissing());
  } else if (!YEAR_RE.test(ay)) {
    list.push(t().validate.yearBad(ay));
  }

  if (doc.semesters.length === 0) list.push(t().validate.semestersEmpty());
  doc.semesters.forEach((s, i) => {
    const p = `semesters[${i}]`;
    checkPosInt(list, `${p}.semester`, s.semester, 1);
    checkPosInt(list, `${p}.total_weeks`, s.total_weeks, 1);
    checkDateRange(list, `${p}.semester_*`, s.semester_start, s.semester_end);
    checkDateRange(list, `${p}.orientation_week`, s.orientation_week.start, s.orientation_week.end);
    checkDateRange(list, `${p}.exam_period`, s.exam_period.start, s.exam_period.end);
    s.midterm_controls.forEach((mc, j) => checkNamedRange(list, `${p}.midterm_controls[${j}]`, mc));
    s.holidays.forEach((h, j) => checkNamedRange(list, `${p}.holidays[${j}]`, h));
  });

  doc.practices.forEach((pr, i) => checkNamedRange(list, `practices[${i}]`, pr));
  checkDateRange(list, 'grading_period', doc.grading_period.start, doc.grading_period.end);

  return list;
}
