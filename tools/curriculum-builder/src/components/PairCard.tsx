import { useEffect, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import type { DayOfWeek, LessonType, ScheduleEntry, SubjectDoc } from '../types';
import { t } from '../lib/i18n';
import { FieldHead } from './bits';

const DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface Props {
  entry: ScheduleEntry;
  /** Свёрнутая карточка показывает только сводку (и её можно тащить целиком). */
  open: boolean;
  dragging: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ScheduleEntry>) => void;
  /** Смена дня селектом — время сохраняется, целевой день раскрывается. */
  onMoveDay: (day: DayOfWeek) => void;
  onRemove: () => void;
  onMoveSlot: (dir: -1 | 1) => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
  library: SubjectDoc[];
}

const toNullable = (v: string): string | null => (v.trim() === '' ? null : v);

/**
 * Карточка одной пары: свёрнутая сводка или открытая форма со всеми полями.
 * Время начала/конца редактируется через черновик и коммитится по onBlur —
 * чтобы карточка не «съезжала» по слотам посреди ввода.
 */
export default function PairCard({
  entry,
  open,
  dragging,
  canMoveUp,
  canMoveDown,
  onToggle,
  onChange,
  onMoveDay,
  onRemove,
  onMoveSlot,
  onDragStart,
  onDragEnd,
  library,
}: Props) {
  const tr = t();
  const st = tr.schedule;
  const f = tr.fields.schedule;

  const [startDraft, setStartDraft] = useState(entry.start);
  const [endDraft, setEndDraft] = useState(entry.end);
  // Пересинхронизация черновика, когда committed-значение меняется извне (перетаскивание, сортировка).
  useEffect(() => {
    setStartDraft(entry.start);
  }, [entry.start]);
  useEffect(() => {
    setEndDraft(entry.end);
  }, [entry.end]);

  const commitTime = (): void => {
    if (startDraft !== entry.start) onChange({ start: startDraft });
    if (endDraft !== entry.end) onChange({ end: endDraft });
  };

  const timeKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

  /** Слаг выбран из справочника — подтягиваем название, если оно ещё пустое. */
  const handleSubjectId = (v: string): void => {
    const match = library.find((s) => s.subject_id === v.trim());
    if (match !== undefined && entry.subject_name.trim() === '') {
      onChange({ subject_id: v, subject_name: match.subject_name });
    } else {
      onChange({ subject_id: v });
    }
  };

  if (!open) {
    return (
      <div
        className={'pair-card collapsed' + (dragging ? ' dragging' : '')}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={false}
        title={st.dragHint}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="pair-summary">
          <span className="pair-time">
            {entry.start}–{entry.end}
          </span>
          <span className="pair-name">{entry.subject_name !== '' ? entry.subject_name : tr.common.untitled}</span>
          {entry.type !== null && <span className="badge">{st.lessonTypes[entry.type].label}</span>}
          {entry.group !== null && entry.group !== '' && <span className="muted pair-group">{entry.group}</span>}
          <span className="pair-handle-hint" aria-hidden>
            ⠿
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={'pair-card' + (dragging ? ' dragging' : '')}>
      <div className="pair-toolbar">
        <button
          type="button"
          className="btn-icon pair-handle"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          title={tr.common.dragHandle}
        >
          ⠿
        </button>
        <span className="pair-time mono">
          {entry.start}–{entry.end}
        </span>
        <span className="pair-toolbar-spacer" />
        <button
          type="button"
          className="btn-icon"
          title={st.moveUpSlot}
          disabled={!canMoveUp}
          onClick={() => onMoveSlot(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="btn-icon"
          title={st.moveDownSlot}
          disabled={!canMoveDown}
          onClick={() => onMoveSlot(1)}
        >
          ↓
        </button>
        <button type="button" className="btn-icon" title={tr.common.collapse} onClick={onToggle}>
          ▴
        </button>
        <button type="button" className="btn-icon danger" title={tr.common.remove} onClick={onRemove}>
          ✕
        </button>
      </div>

      <div className="pair-fields">
        <div className="field">
          <FieldHead label={f.day.label} keyName="day" hint={f.day.hint} />
          <select
            value={entry.day}
            title={st.moveDayTitle}
            onChange={(e) => onMoveDay(e.target.value as DayOfWeek)}
          >
            {DAYS.map((value) => (
              <option key={value} value={value} title={st.days[value].title}>
                {st.days[value].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <FieldHead label={f.start.label} keyName="start" hint={f.start.hint} />
          <input
            type="time"
            value={startDraft}
            onBlur={commitTime}
            onKeyDown={timeKeyDown}
            onChange={(e) => setStartDraft(e.target.value)}
          />
        </div>
        <div className="field">
          <FieldHead label={f.end.label} keyName="end" hint={f.end.hint} />
          <input
            type="time"
            value={endDraft}
            onBlur={commitTime}
            onKeyDown={timeKeyDown}
            onChange={(e) => setEndDraft(e.target.value)}
          />
        </div>
        <div className="field field-wide">
          <FieldHead label={f.subject_id.label} keyName="subject_id" hint={f.subject_id.hint} />
          <input
            list="cb-subject-ids"
            value={entry.subject_id}
            placeholder={st.subjectIdPlaceholder}
            onChange={(e) => handleSubjectId(e.target.value)}
          />
        </div>
        <div className="field field-wide">
          <FieldHead label={f.subject_name.label} keyName="subject_name" hint={f.subject_name.hint} />
          <input
            list="cb-subject-names"
            value={entry.subject_name}
            placeholder={st.subjectNamePlaceholder}
            onChange={(e) => onChange({ subject_name: e.target.value })}
          />
        </div>
        <div className="field">
          <FieldHead label={f.type.label} keyName="type" hint={f.type.hint} />
          <select
            value={entry.type ?? ''}
            title={st.lessonTypes[entry.type ?? 'none'].title}
            onChange={(e) => onChange({ type: e.target.value === '' ? null : (e.target.value as LessonType) })}
          >
            {(['none', 'lecture', 'practice'] as const).map((key) => (
              <option key={key} value={key === 'none' ? '' : key} title={st.lessonTypes[key].title}>
                {st.lessonTypes[key].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <FieldHead label={f.room.label} keyName="room" hint={f.room.hint} />
          <input
            value={entry.room ?? ''}
            placeholder={st.roomPlaceholder}
            onChange={(e) => onChange({ room: toNullable(e.target.value) })}
          />
        </div>
        <div className="field">
          <FieldHead label={f.teacher.label} keyName="teacher" hint={f.teacher.hint} />
          <input
            value={entry.teacher ?? ''}
            placeholder={st.teacherPlaceholder}
            onChange={(e) => onChange({ teacher: toNullable(e.target.value) })}
          />
        </div>
        <div className="field">
          <FieldHead label={f.group.label} keyName="group" hint={f.group.hint} />
          <input
            value={entry.group ?? ''}
            placeholder={st.groupPlaceholder}
            onChange={(e) => onChange({ group: toNullable(e.target.value) })}
          />
        </div>
        <div className="field">
          <FieldHead label={f.valid_from.label} keyName="valid_from" hint={f.valid_from.hint} />
          <input
            type="date"
            value={entry.valid_from ?? ''}
            onChange={(e) => onChange({ valid_from: toNullable(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}
