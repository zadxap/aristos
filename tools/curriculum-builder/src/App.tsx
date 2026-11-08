import { useEffect, useMemo, useState } from 'react';
import type { AcadCalendarDoc, DocKind, ScheduleDoc, SubjectDoc } from './types';
import { emptyAcadCalendar, emptySchedule, emptySubject } from './lib/defaults';
import { isBackupDocument, parseAcadCalendar, parseBackup, parseSchedule, parseSubject } from './lib/parse';
import type { AristosBackup, ParseResult } from './lib/parse';
import { applyLang, applyTheme, getLang, getTheme, t } from './lib/i18n';
import type { Lang, Theme } from './lib/i18n';
import {
  clearAllDrafts,
  loadDraft,
  loadLibrary,
  loadStoredCalendars,
  loadStoredSchedules,
  removeFromLibrary,
  removeStoredCalendar,
  removeStoredSchedule,
  saveDraft,
  scheduleDocKey,
  upsertLibrary,
  upsertStoredCalendar,
  upsertStoredSchedule,
} from './lib/storage';
import { toExportAcadCalendar, toExportSchedule, toExportSubject } from './lib/sanitize';
import { validateAcadCalendar, validateSchedule, validateSubject } from './lib/validate';
import SubjectEditor from './components/SubjectEditor';
import ScheduleEditor from './components/ScheduleEditor';
import CalendarEditor from './components/CalendarEditor';
import ImportPanel from './components/ImportPanel';
import type { ImportStatus } from './components/ImportPanel';
import ExportPanel from './components/ExportPanel';
import LibraryPanel from './components/LibraryPanel';
import StorePanel, { hasStore } from './components/StorePanel';
import AiPanel from './components/AiPanel';
import ValidationList from './components/ValidationList';

const TAB_KEYS: DocKind[] = ['subject', 'schedule', 'calendar'];
const LANGS: Lang[] = ['ru', 'kk'];

interface ExportInfo {
  filename: string;
  json: string;
  errors: string[];
}

function bootstrapDoc<T>(kind: DocKind, fallback: () => T, parse: (raw: unknown) => ParseResult<T>): T {
  const raw = loadDraft(kind);
  if (raw !== null) {
    const result = parse(raw);
    if (result.ok) return result.doc;
  }
  return fallback();
}

export default function App() {
  const [tab, setTab] = useState<DocKind>('subject');
  const [lang, setLang] = useState<Lang>(() => getLang());
  const [theme, setTheme] = useState<Theme>(() => getTheme());
  const [subject, setSubject] = useState<SubjectDoc>(() => bootstrapDoc('subject', emptySubject, parseSubject));
  const [schedule, setSchedule] = useState<ScheduleDoc>(() => bootstrapDoc('schedule', emptySchedule, parseSchedule));
  const [calendar, setCalendar] = useState<AcadCalendarDoc>(() =>
    bootstrapDoc('calendar', emptyAcadCalendar, parseAcadCalendar),
  );
  const [library, setLibrary] = useState<SubjectDoc[]>(() => loadLibrary());
  const [storedSchedules, setStoredSchedules] = useState<ScheduleDoc[]>(() => loadStoredSchedules());
  const [storedCalendars, setStoredCalendars] = useState<AcadCalendarDoc[]>(() => loadStoredCalendars());
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);

  // Автосохранение черновиков в localStorage.
  useEffect(() => {
    saveDraft('subject', subject);
  }, [subject]);
  useEffect(() => {
    saveDraft('schedule', schedule);
  }, [schedule]);
  useEffect(() => {
    saveDraft('calendar', calendar);
  }, [calendar]);

  // Тема: <html data-theme="..."> + localStorage. Только ручной тоггл.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function switchLang(next: Lang): void {
    applyLang(next);
    setLang(next);
  }

  function toggleTheme(): void {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  const exportInfo = useMemo<ExportInfo>(() => {
    if (tab === 'subject') {
      const clean = toExportSubject(subject);
      return {
        filename: `${clean.subject_id !== '' ? clean.subject_id : 'subject'}.json`,
        json: JSON.stringify(clean, null, 2),
        errors: validateSubject(clean),
      };
    }
    if (tab === 'schedule') {
      const clean = toExportSchedule(schedule);
      return {
        filename: 'schedule.json',
        json: JSON.stringify(clean, null, 2),
        errors: validateSchedule(clean),
      };
    }
    const clean = toExportAcadCalendar(calendar);
    return {
      filename: 'acad_calendar.json',
      json: JSON.stringify(clean, null, 2),
      errors: validateAcadCalendar(clean),
    };
    // lang — зависимость: сообщения валидации должны перевестись сразу.
  }, [tab, subject, schedule, calendar, lang]);

  function handleImport(text: string): void {
    const tr = t().import;
    const cleaned = text.replace(/^\uFEFF/, '').trim();
    let raw: unknown;
    try {
      raw = JSON.parse(cleaned);
    } catch (e) {
      setImportStatus({
        kind: 'error',
        text: tr.badJson(e instanceof Error ? e.message : String(e)),
      });
      return;
    }

    // Полный бекап Aristos: раскладываем всё по хранилищам, редактор не затрагиваем
    // (кроме случая, когда документ текущей вкладки в бекапе ровно один).
    if (isBackupDocument(raw)) {
      const backup = parseBackup(raw);
      if (backup.ok) {
        applyBackupImport(backup.doc);
      } else {
        setImportStatus({
          kind: 'error',
          text: tr.backupUnrecognized(backup.errors.join(' ')),
        });
      }
      return;
    }

    // Сначала пробуем активную вкладку, затем остальные типы документов.
    const order: DocKind[] =
      tab === 'subject'
        ? ['subject', 'schedule', 'calendar']
        : tab === 'schedule'
          ? ['schedule', 'subject', 'calendar']
          : ['calendar', 'schedule', 'subject'];

    const activeErrors: string[] = [];
    for (const kind of order) {
      let loaded = false;
      let errors: string[] = [];
      if (kind === 'subject') {
        const r = parseSubject(raw);
        if (r.ok) {
          setSubject(r.doc);
          loaded = true;
        } else errors = r.errors;
      } else if (kind === 'schedule') {
        const r = parseSchedule(raw);
        if (r.ok) {
          setSchedule(r.doc);
          loaded = true;
        } else errors = r.errors;
      } else {
        const r = parseAcadCalendar(raw);
        if (r.ok) {
          setCalendar(r.doc);
          loaded = true;
        } else errors = r.errors;
      }
      if (loaded) {
        setTab(kind);
        setImportStatus({ kind: 'ok', text: tr.importedToTab(t().tabs[kind]) });
        return;
      }
      if (kind === tab) activeErrors.push(...errors);
    }

    setImportStatus({
      kind: 'error',
      text: tr.noTypeMatch(
        activeErrors.length > 0
          ? tr.errorsAsTab(t().tabs[tab], activeErrors.join(' '))
          : '',
      ),
    });
  }

  /** Импорт полного бекапа: upsert по ключам + автороутинг единственного документа в редактор. */
  function applyBackupImport(backup: AristosBackup): void {
    const tr = t().import;
    const { subjects, schedules, calendars, skipped } = backup;

    // subjects → библиотека «Мои пәндеры» (ключ subject_id, дубликаты перезаписываются).
    let lib = loadLibrary();
    for (const s of subjects) lib = upsertLibrary(s);
    if (subjects.length > 0) setLibrary(lib);

    // schedules → хранилище (ключ «курс-семестр», дубликаты перезаписываются).
    let nextSchedules = loadStoredSchedules();
    for (const s of schedules) nextSchedules = upsertStoredSchedule(s);
    if (schedules.length > 0) setStoredSchedules(nextSchedules);

    // calendars → хранилище (ключ course, дубликаты перезаписываются).
    let nextCalendars = loadStoredCalendars();
    for (const c of calendars) nextCalendars = upsertStoredCalendar(c);
    if (calendars.length > 0) setStoredCalendars(nextCalendars);

    // В редактор попадает документ текущей вкладки, только если он в бекапе ровно один.
    let editorNote: string | null = null;
    if (tab === 'schedule' && schedules.length === 1) {
      setSchedule(schedules[0]);
      editorNote = tr.scheduleLoaded(scheduleDocKey(schedules[0]));
    } else if (tab === 'calendar' && calendars.length === 1) {
      setCalendar(calendars[0]);
      editorNote = tr.calendarLoaded(calendars[0].course);
    }

    const parts: string[] = [];
    if (subjects.length > 0) parts.push(tr.partSubjects(subjects.length));
    if (schedules.length > 0) {
      parts.push(tr.partSchedules(schedules.length, schedules.map(scheduleDocKey).join(', ')));
    }
    if (calendars.length > 0) {
      parts.push(tr.partCalendars(calendars.length, calendars.map((c) => c.course).join(', ')));
    }

    if (parts.length === 0) {
      setImportStatus({
        kind: 'error',
        text: tr.backupEmpty(skipped),
      });
      return;
    }

    const lines: string[] = [tr.importedSummary(parts.join(', '))];
    if (skipped > 0) lines.push(tr.skippedSummary(skipped));
    if (editorNote !== null) lines.push(editorNote);
    if (schedules.length > 0 || calendars.length > 0) {
      lines.push(tr.storeHint);
    }
    setImportStatus({ kind: 'ok', text: lines.join('\n') });
  }

  function handleClearDrafts(): void {
    if (!window.confirm(t().clearConfirm)) {
      return;
    }
    clearAllDrafts();
    setSubject(emptySubject());
    setSchedule(emptySchedule());
    setCalendar(emptyAcadCalendar());
    setImportStatus(null);
  }

  const tr = t();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Curriculum Builder</span>
          <span className="brand-sub">{tr.brandSub}</span>
        </div>
        <nav className="tabs" role="tablist" aria-label={tr.docTypeAria}>
          {TAB_KEYS.map((kind) => (
            <button
              key={kind}
              role="tab"
              aria-selected={tab === kind}
              className={'tab' + (tab === kind ? ' active' : '')}
              onClick={() => setTab(kind)}
            >
              {tr.tabs[kind]}
            </button>
          ))}
        </nav>
        <div className="header-tools">
          <div className="seg" role="group" aria-label={tr.langToggleAria}>
            {LANGS.map((l) => (
              <button
                key={l}
                className={'seg-btn' + (lang === l ? ' active' : '')}
                aria-pressed={lang === l}
                onClick={() => switchLang(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            className="btn-icon theme-toggle"
            title={tr.themeToggleTitle(theme)}
            aria-label={tr.themeToggleTitle(theme)}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button className="btn ghost" onClick={handleClearDrafts} title={tr.clearTitle}>
            {tr.clear}
          </button>
        </div>
      </header>

      <div className="layout">
        <main className="editor-col">
          {tab === 'subject' && <SubjectEditor doc={subject} onChange={setSubject} />}
          {tab === 'schedule' && <ScheduleEditor doc={schedule} onChange={setSchedule} library={library} />}
          {tab === 'calendar' && <CalendarEditor doc={calendar} onChange={setCalendar} />}
          <ValidationList issues={exportInfo.errors} />
        </main>

        <aside className="side-col">
          <ExportPanel filename={exportInfo.filename} json={exportInfo.json} errors={exportInfo.errors} />
          <ImportPanel onImport={handleImport} status={importStatus} tabTitle={tr.tabs[tab]} />
          {tab === 'subject' && (
            <LibraryPanel
              library={library}
              current={subject}
              onSave={(doc) => setLibrary(upsertLibrary(doc))}
              onLoad={(doc) => setSubject(doc)}
              onDelete={(id) => setLibrary(removeFromLibrary(id))}
            />
          )}
          {hasStore(tab) && (
            <StorePanel
              tab={tab}
              schedules={storedSchedules}
              calendars={storedCalendars}
              onLoadSchedule={(doc) => setSchedule(doc)}
              onLoadCalendar={(doc) => setCalendar(doc)}
              onDeleteSchedule={(course, semester) => setStoredSchedules(removeStoredSchedule(course, semester))}
              onDeleteCalendar={(course) => setStoredCalendars(removeStoredCalendar(course))}
            />
          )}
          <AiPanel
            activeTab={tab}
            onApply={{
              subject: (doc) => setSubject(doc),
              schedule: (doc) => setSchedule(doc),
              calendar: (doc) => setCalendar(doc),
            }}
          />
        </aside>
      </div>

      <footer className="footer">{tr.footer}</footer>
    </div>
  );
}
