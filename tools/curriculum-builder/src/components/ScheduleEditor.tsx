import { useState } from 'react';
import type { DragEvent } from 'react';
import type { DayOfWeek, ScheduleDoc, ScheduleEntry, SubjectDoc } from '../types';
import { emptyScheduleEntry } from '../lib/defaults';
import { t } from '../lib/i18n';
import { GroupCard, NumberField, Section } from './bits';
import PairCard from './PairCard';

const DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** В روزной доске всегда показываем Пн–Сб; Вс появляется, только если есть пары. */
const BOARD_DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const DAY_ORDER: Record<DayOfWeek, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

/** Сетка академического дня: 9 слотов по 50 минут, 09:00–17:50. */
const GRID_SLOTS: ReadonlyArray<{ start: string; end: string }> = [
  { start: '09:00', end: '09:50' },
  { start: '10:00', end: '10:50' },
  { start: '11:00', end: '11:50' },
  { start: '12:00', end: '12:50' },
  { start: '13:00', end: '13:50' },
  { start: '14:00', end: '14:50' },
  { start: '15:00', end: '15:50' },
  { start: '16:00', end: '16:50' },
  { start: '17:00', end: '17:50' },
];

const SLOT_STARTS = new Map(GRID_SLOTS.map((s, i) => [s.start, i]));

const toMin = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const fmtMin = (min: number): string =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Длительность пары в минутах; нестандартная сохраняется, битая считается 50 минутами. */
const durationOf = (e: ScheduleEntry): number => {
  const d = toMin(e.end) - toMin(e.start);
  return Number.isFinite(d) && d > 0 ? d : 50;
};

interface SlotTarget {
  day: DayOfWeek;
  slot: number;
}

interface Props {
  doc: ScheduleDoc;
  onChange: (doc: ScheduleDoc) => void;
  /** Сохранённые Subject из «Мои пәндеры» — справочник для datalist. */
  library: SubjectDoc[];
}

export default function ScheduleEditor({ doc, onChange, library }: Props) {
  const tr = t();
  const st = tr.schedule;
  const f = tr.fields.schedule;
  const entries = doc.schedule;
  const set = <K extends keyof ScheduleDoc>(key: K, value: ScheduleDoc[K]): void =>
    onChange({ ...doc, [key]: value });

  // Дни, где есть пары, по умолчанию развёрнуты; остальные свёрнуты.
  const [openDays, setOpenDays] = useState<Record<DayOfWeek, boolean>>(() => {
    const rec: Record<DayOfWeek, boolean> = { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false };
    for (const e of entries) rec[e.day] = true;
    return rec;
  });
  // Открытые (на редактирование) карточки пар — по индексу в плоском массиве.
  const [openCards, setOpenCards] = useState<ReadonlySet<number>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<SlotTarget | null>(null);

  const updateEntry = (index: number, patch: Partial<ScheduleEntry>): void =>
    set('schedule', entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  const removeEntry = (index: number): void => {
    set('schedule', entries.filter((_, i) => i !== index));
    setOpenCards((prev) => {
      const next = new Set<number>();
      for (const v of prev) if (v !== index) next.add(v < index ? v : v - 1);
      return next;
    });
  };

  const toggleCard = (index: number): void =>
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const toggleDay = (day: DayOfWeek): void =>
    setOpenDays((prev) => ({ ...prev, [day]: !prev[day] }));

  // -------------------------------------------------------------- слоты/перемещение

  /** Перенести пару в конкретный слот: день и время слота, длительность сохраняется. */
  const moveEntryToSlot = (index: number, day: DayOfWeek, slot: number): void => {
    const e = entries[index];
    if (e === undefined) return;
    const start = GRID_SLOTS[slot].start;
    updateEntry(index, { day, start, end: fmtMin(toMin(start) + durationOf(e)) });
    setOpenDays((prev) => ({ ...prev, [day]: true }));
  };

  /** ↑/↓ — соседний слот того же дня (дублирует перетаскивание для тача). */
  const moveEntrySlot = (index: number, dir: -1 | 1): void => {
    const e = entries[index];
    const si = SLOT_STARTS.get(e.start);
    if (si === undefined) return;
    const to = si + dir;
    if (to < 0 || to >= GRID_SLOTS.length) return;
    moveEntryToSlot(index, e.day, to);
  };

  /** Смена дня селектом: время пары сохраняется как есть. */
  const moveEntryDay = (index: number, day: DayOfWeek): void => {
    updateEntry(index, { day });
    setOpenDays((prev) => ({ ...prev, [day]: true }));
  };

  /** Новая пара в конкретный слот — карточка сразу открыта на редактирование. */
  const addEntryAt = (day: DayOfWeek, slot: number): void => {
    const s = GRID_SLOTS[slot];
    const fresh: ScheduleEntry = { ...emptyScheduleEntry(), day, start: s.start, end: s.end };
    set('schedule', [...entries, fresh]);
    setOpenCards((prev) => new Set(prev).add(entries.length));
    setOpenDays((prev) => ({ ...prev, [day]: true }));
  };

  /** Первый слот дня без пар (если все заняты — складываем в первый слот). */
  const freeSlotOfDay = (day: DayOfWeek): number => {
    const i = GRID_SLOTS.findIndex((s) => !entries.some((e) => e.day === day && e.start === s.start));
    return i === -1 ? 0 : i;
  };

  const addPairToDay = (day: DayOfWeek): void => addEntryAt(day, freeSlotOfDay(day));

  /** Глобальный «+ пара»: первый свободный слот первого дня. */
  const addPairGlobal = (): void => {
    for (const day of DAYS) {
      const slot = GRID_SLOTS.findIndex((s) => !entries.some((e) => e.day === day && e.start === s.start));
      if (slot !== -1) {
        addEntryAt(day, slot);
        return;
      }
    }
    addEntryAt('mon', 0);
  };

  const clearDay = (day: DayOfWeek): void => {
    if (!window.confirm(st.clearDayConfirm(st.days[day].title.split(' — ')[0]))) return;
    set('schedule', entries.filter((e) => e.day !== day));
    setOpenCards(new Set());
  };

  const sortEntries = (): void =>
    set(
      'schedule',
      [...entries].sort(
        (a, b) =>
          DAY_ORDER[a.day] - DAY_ORDER[b.day] ||
          a.start.localeCompare(b.start) ||
          a.end.localeCompare(b.end),
      ),
    );

  // -------------------------------------------------------------- drag & drop

  const handleDragStart = (index: number) => (e: DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragEnd = (): void => {
    setDragIndex(null);
    setDropTarget(null);
  };

  const slotDragOver = (day: DayOfWeek, slot: number) => (e: DragEvent) => {
    if (dragIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget((prev) => (prev !== null && prev.day === day && prev.slot === slot ? prev : { day, slot }));
  };

  const slotDragLeave = (day: DayOfWeek, slot: number) => (e: DragEvent) => {
    // dragleave срабатывает и при переходе на дочерние элементы — проверяем relatedTarget.
    if (e.relatedTarget !== null && e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDropTarget((prev) => (prev !== null && prev.day === day && prev.slot === slot ? null : prev));
  };

  const slotDrop = (day: DayOfWeek, slot: number) => (e: DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const idx = Number(raw);
    setDropTarget(null);
    setDragIndex(null);
    if (Number.isInteger(idx) && entries[idx] !== undefined) {
      moveEntryToSlot(idx, day, slot);
    }
  };

  // -------------------------------------------------------------- разбор по дням/слотам

  const boardDays: DayOfWeek[] = entries.some((e) => e.day === 'sun') ? [...BOARD_DAYS, 'sun'] : BOARD_DAYS;

  const renderPairCard = (index: number): JSX.Element => {
    const e = entries[index];
    const si = SLOT_STARTS.get(e.start);
    return (
      <PairCard
        key={index}
        entry={e}
        open={openCards.has(index)}
        dragging={dragIndex === index}
        canMoveUp={si !== undefined && si > 0}
        canMoveDown={si !== undefined && si < GRID_SLOTS.length - 1}
        onToggle={() => toggleCard(index)}
        onChange={(patch) => updateEntry(index, patch)}
        onMoveDay={(day) => moveEntryDay(index, day)}
        onRemove={() => removeEntry(index)}
        onMoveSlot={(dir) => moveEntrySlot(index, dir)}
        onDragStart={handleDragStart(index)}
        onDragEnd={handleDragEnd}
        library={library}
      />
    );
  };

  return (
    <Section title={st.title} subtitle="Schedule · schedule.json">
      <div className="fields">
        <NumberField label={f.course.label} keyName="course" hint={f.course.hint} min={1} value={doc.course} onChange={(v) => set('course', v)} />
        <NumberField label={f.semester.label} keyName="semester" hint={f.semester.hint} min={1} value={doc.semester} onChange={(v) => set('semester', v)} />
        <div className="field field-actions">
          <span className="field-label">
            <span className="field-name">{tr.common.entriesCount(entries.length)}</span>
          </span>
          <div className="btn-row">
            <button className="btn" onClick={addPairGlobal}>
              {st.addPair}
            </button>
            <button className="btn" onClick={sortEntries} disabled={entries.length < 2}>
              {st.sort}
            </button>
          </div>
        </div>
      </div>

      <p className="hint">
        {library.length === 0 ? st.libraryEmptyHint : st.libraryHint(library.length)}
      </p>
      {entries.length > 0 && <p className="hint">{st.dragHint}</p>}

      <div className="day-board">
        {boardDays.map((day) => {
          const dayIdx = entries.map((e, i) => (e.day === day ? i : -1)).filter((i) => i >= 0);
          const slotIdx: number[][] = GRID_SLOTS.map(() => []);
          const other: number[] = [];
          for (const i of dayIdx) {
            const si = SLOT_STARTS.get(entries[i].start);
            if (si === undefined) other.push(i);
            else slotIdx[si].push(i);
          }
          const open = openDays[day];
          return (
            <GroupCard
              key={day}
              open={open}
              onToggle={() => toggleDay(day)}
              title={st.days[day].label}
              titleTitle={st.days[day].title}
              count={dayIdx.length}
              actions={
                <>
                  <button className="btn small" title={st.addDayTitle} onClick={() => addPairToDay(day)}>
                    {st.addPairHere}
                  </button>
                  <button
                    className="btn small ghost"
                    disabled={dayIdx.length === 0}
                    title={st.clearDay}
                    onClick={() => clearDay(day)}
                  >
                    {st.clearDay}
                  </button>
                </>
              }
            >
              {GRID_SLOTS.map((slot, si) => {
                const ids = slotIdx[si];
                const isDrop = dropTarget !== null && dropTarget.day === day && dropTarget.slot === si;
                return (
                  <div className="slot-row" key={slot.start}>
                    <span className="slot-time mono">
                      {slot.start}–{slot.end}
                    </span>
                    <div
                      className={
                        'slot-zone' +
                        (ids.length > 0 ? ' filled' : ' empty') +
                        (isDrop ? ' drop' : '')
                      }
                      onDragOver={slotDragOver(day, si)}
                      onDragLeave={slotDragLeave(day, si)}
                      onDrop={slotDrop(day, si)}
                    >
                      {ids.map((i) => renderPairCard(i))}
                      {ids.length === 0 && (
                        <button
                          type="button"
                          className="slot-add"
                          title={st.emptySlotTitle}
                          onClick={() => addEntryAt(day, si)}
                        >
                          {st.addPairHere}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {other.length > 0 && (
                <div className="slot-row">
                  <span className="slot-time mono" />
                  <div className="other-time">
                    <div className="other-time-title">{st.otherTime}</div>
                    {other.map((i) => renderPairCard(i))}
                  </div>
                </div>
              )}
            </GroupCard>
          );
        })}
        {entries.length === 0 && <p className="empty-note">{st.entriesEmpty}</p>}
      </div>

      <datalist id="cb-subject-ids">
        {library.map((s) => (
          <option key={s.subject_id} value={s.subject_id}>
            {s.subject_name}
          </option>
        ))}
      </datalist>
      <datalist id="cb-subject-names">
        {library.map((s) => (
          <option key={s.subject_id} value={s.subject_name}>
            {s.subject_code !== '' ? s.subject_code : s.subject_id}
          </option>
        ))}
      </datalist>
    </Section>
  );
}
