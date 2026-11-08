import type { AcadCalendarDoc, DocKind, ScheduleDoc, SubjectDoc } from '../types';
import { isRecord, parseAcadCalendar, parseSchedule, parseSubject } from './parse';
import type { AiProvider, AiSettings } from './ai';

/** Хранилище браузера: черновики, справочник «Мои пәндеры», хранилище кесте/күнтізбе, настройки AI. */

const DRAFT_PREFIX = 'aristos-cb:draft:';
const LIB_KEY = 'aristos-cb:library';
const SCHEDULES_KEY = 'aristos-cb:schedules';
const CALENDARS_KEY = 'aristos-cb:calendars';
const AI_KEY = 'aristos-cb:ai';
/** Ключ из ранних версий — читается для миграции. */
const AI_KEY_LEGACY = 'aristos-cb:ai-settings';

const DRAFT_KINDS = ['subject', 'schedule', 'calendar'] as const;

function readJson(key: string): unknown {
  try {
    const text = window.localStorage.getItem(key);
    if (text === null) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Хранилище недоступно (приватный режим/переполнение) — работаем без автосохранения.
  }
}

// ---------------------------------------------------------------- Черновики

export function loadDraft(kind: DocKind): unknown {
  return readJson(DRAFT_PREFIX + kind);
}

export function saveDraft(kind: DocKind, doc: unknown): void {
  writeJson(DRAFT_PREFIX + kind, doc);
}

export function clearAllDrafts(): void {
  try {
    for (const kind of DRAFT_KINDS) window.localStorage.removeItem(DRAFT_PREFIX + kind);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------- Мои пәндеры

export function loadLibrary(): SubjectDoc[] {
  const raw = readJson(LIB_KEY);
  if (!Array.isArray(raw)) return [];
  const out: SubjectDoc[] = [];
  for (const item of raw) {
    const parsed = parseSubject(item);
    if (parsed.ok) out.push(parsed.doc);
  }
  return out;
}

function saveLibrary(items: SubjectDoc[]): void {
  writeJson(LIB_KEY, items);
}

/** Добавляет/обновляет предмет (ключ — subject_id), возвращает новый список. */
export function upsertLibrary(doc: SubjectDoc): SubjectDoc[] {
  const clean: SubjectDoc = { ...doc, subject_id: doc.subject_id.trim() };
  const rest = loadLibrary().filter((s) => s.subject_id !== clean.subject_id);
  const next = [clean, ...rest];
  saveLibrary(next);
  return next;
}

export function removeFromLibrary(subjectId: string): SubjectDoc[] {
  const next = loadLibrary().filter((s) => s.subject_id !== subjectId);
  saveLibrary(next);
  return next;
}

// ---------------------------------------------------------------- Хранилище кесте

/** Ключ хранения расписания — «курс-семестр», например «2-1». */
export function scheduleDocKey(doc: Pick<ScheduleDoc, 'course' | 'semester'>): string {
  return `${doc.course}-${doc.semester}`;
}

function byCourseSemester(a: ScheduleDoc, b: ScheduleDoc): number {
  return a.course - b.course || a.semester - b.semester;
}

export function loadStoredSchedules(): ScheduleDoc[] {
  const raw = readJson(SCHEDULES_KEY);
  if (!Array.isArray(raw)) return [];
  const out: ScheduleDoc[] = [];
  for (const item of raw) {
    const parsed = parseSchedule(item);
    if (parsed.ok) out.push(parsed.doc);
  }
  return out.sort(byCourseSemester);
}

/** Добавляет/обновляет расписание (ключ «курс-семестр»), возвращает новый список. */
export function upsertStoredSchedule(doc: ScheduleDoc): ScheduleDoc[] {
  const key = scheduleDocKey(doc);
  const next = loadStoredSchedules()
    .filter((s) => scheduleDocKey(s) !== key)
    .concat(doc)
    .sort(byCourseSemester);
  writeJson(SCHEDULES_KEY, next);
  return next;
}

export function removeStoredSchedule(course: number, semester: number): ScheduleDoc[] {
  const next = loadStoredSchedules().filter((s) => s.course !== course || s.semester !== semester);
  writeJson(SCHEDULES_KEY, next);
  return next;
}

// ---------------------------------------------------------------- Хранилище күнтізбе

function byCourse(a: AcadCalendarDoc, b: AcadCalendarDoc): number {
  return a.course - b.course;
}

export function loadStoredCalendars(): AcadCalendarDoc[] {
  const raw = readJson(CALENDARS_KEY);
  if (!Array.isArray(raw)) return [];
  const out: AcadCalendarDoc[] = [];
  for (const item of raw) {
    const parsed = parseAcadCalendar(item);
    if (parsed.ok) out.push(parsed.doc);
  }
  return out.sort(byCourse);
}

/** Добавляет/обновляет күнтізбе (ключ — course), возвращает новый список. */
export function upsertStoredCalendar(doc: AcadCalendarDoc): AcadCalendarDoc[] {
  const next = loadStoredCalendars()
    .filter((c) => c.course !== doc.course)
    .concat(doc)
    .sort(byCourse);
  writeJson(CALENDARS_KEY, next);
  return next;
}

export function removeStoredCalendar(course: number): AcadCalendarDoc[] {
  const next = loadStoredCalendars().filter((c) => c.course !== course);
  writeJson(CALENDARS_KEY, next);
  return next;
}

// ---------------------------------------------------------------- AI-настройки

const AI_PROVIDERS: AiProvider[] = ['openai-compat', 'google-gemini'];

export function loadAiSettings(): AiSettings | null {
  let raw = readJson(AI_KEY);
  if (raw === null) raw = readJson(AI_KEY_LEGACY);
  if (!isRecord(raw)) return null;

  // Новый формат: { provider, openai: {...}, gemini: {...} }
  if (typeof raw.provider === 'string' && (AI_PROVIDERS as string[]).includes(raw.provider)) {
    const openai = isRecord(raw.openai) ? raw.openai : {};
    const gemini = isRecord(raw.gemini) ? raw.gemini : {};
    return {
      provider: raw.provider as AiProvider,
      openai: {
        baseUrl: typeof openai.baseUrl === 'string' ? openai.baseUrl : '',
        apiKey: typeof openai.apiKey === 'string' ? openai.apiKey : '',
        model: typeof openai.model === 'string' ? openai.model : '',
      },
      gemini: {
        apiKey: typeof gemini.apiKey === 'string' ? gemini.apiKey : '',
        model: typeof gemini.model === 'string' ? gemini.model : '',
      },
    };
  }

  // Миграция старого формата { baseUrl, apiKey, model } -> openai-compat
  const baseUrl = typeof raw.baseUrl === 'string' ? raw.baseUrl : '';
  const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey : '';
  const model = typeof raw.model === 'string' ? raw.model : '';
  if (baseUrl === '' && apiKey === '' && model === '') return null;
  return {
    provider: 'openai-compat',
    openai: { baseUrl, apiKey, model },
    gemini: { apiKey: '', model: '' },
  };
}

export function saveAiSettings(settings: AiSettings): void {
  writeJson(AI_KEY, settings);
}
