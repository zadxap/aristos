import type { AcadCalendarDoc, DocKind, ScheduleDoc } from '../types';
import { scheduleDocKey } from '../lib/storage';
import { t } from '../lib/i18n';

interface Props {
  tab: 'schedule' | 'calendar';
  schedules: ScheduleDoc[];
  calendars: AcadCalendarDoc[];
  onLoadSchedule: (doc: ScheduleDoc) => void;
  onLoadCalendar: (doc: AcadCalendarDoc) => void;
  onDeleteSchedule: (course: number, semester: number) => void;
  onDeleteCalendar: (course: number) => void;
}

/**
 * Хранилище расписаний и календарей (localStorage), наполняется при импорте
 * полного бекапа Aristos. Позволяет открыть любой сохранённый документ в редакторе.
 */
export default function StorePanel({
  tab,
  schedules,
  calendars,
  onLoadSchedule,
  onLoadCalendar,
  onDeleteSchedule,
  onDeleteCalendar,
}: Props) {
  const tr = t().store;

  if (tab === 'schedule') {
    return (
      <section className="panel">
        <h2 className="panel-title">
          {tr.schedulesTitle} <span className="badge">{schedules.length}</span>
        </h2>
        <p className="hint">{tr.schedulesHint}</p>
        {schedules.length === 0 ? (
          <p className="empty-note">{t().common.nothingSaved}</p>
        ) : (
          <ul className="library">
            {schedules.map((s) => (
              <li key={scheduleDocKey(s)}>
                <button
                  className="lib-open"
                  title={t().common.openInEditor}
                  onClick={() => onLoadSchedule(s)}
                >
                  <span className="lib-name">{tr.scheduleName(s.course, s.semester)}</span>
                  <span className="lib-sub mono">
                    {tr.scheduleSub(scheduleDocKey(s), s.schedule.length)}
                  </span>
                </button>
                <button
                  className="btn-icon danger"
                  title={tr.removeFromStore}
                  onClick={() => onDeleteSchedule(s.course, s.semester)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="panel">
      <h2 className="panel-title">
        {tr.calendarsTitle} <span className="badge">{calendars.length}</span>
      </h2>
      <p className="hint">{tr.calendarsHint}</p>
      {calendars.length === 0 ? (
        <p className="empty-note">{t().common.nothingSaved}</p>
      ) : (
        <ul className="library">
          {calendars.map((c) => (
            <li key={c.course}>
              <button
                className="lib-open"
                title={t().common.openInEditor}
                onClick={() => onLoadCalendar(c)}
              >
                <span className="lib-name">{tr.calendarName(c.course)}</span>
                <span className="lib-sub mono">
                  {c.academic_year !== '' ? `${c.academic_year} · ` : ''}
                  {tr.calendarSub(c.semesters.length)}
                </span>
              </button>
              <button
                className="btn-icon danger"
                title={tr.removeFromStore}
                onClick={() => onDeleteCalendar(c.course)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Type-guard-хелпер: вкладки, для которых существует хранилище. */
export function hasStore(tab: DocKind): tab is 'schedule' | 'calendar' {
  return tab === 'schedule' || tab === 'calendar';
}
