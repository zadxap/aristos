import type { AcadCalendarDoc, DateRange, NamedRange, SemesterCalendar } from '../types';
import { emptyNamedRange, emptySemester } from '../lib/defaults';
import { t } from '../lib/i18n';
import { NumberField, Section, TextField } from './bits';

interface NamedRangesProps {
  title: string;
  subtitle?: string;
  hint: string;
  items: NamedRange[];
  onChange: (items: NamedRange[]) => void;
}

/** Список периодов с опциональным названием: midterm_controls / holidays / practices. */
function NamedRanges({ title, subtitle, hint, items, onChange }: NamedRangesProps) {
  const tr = t();
  const f = tr.fields.calendar;
  const update = (index: number, patch: Partial<NamedRange>): void =>
    onChange(items.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const remove = (index: number): void => onChange(items.filter((_, i) => i !== index));

  return (
    <fieldset className="ranges">
      <legend>
        {title}
        {subtitle !== undefined && <span className="mono muted"> · {subtitle}</span>}
      </legend>
      <p className="field-hint range-hint">{hint}</p>
      <div className="ranges-head">
        <span className="muted">{tr.common.periodsCount(items.length)}</span>
        <button className="btn small" onClick={() => onChange([...items, emptyNamedRange()])}>
          {tr.calendar.add}
        </button>
      </div>
      {items.map((r, i) => (
        <div className="range-item" key={i}>
          <div className="fields">
            <TextField
              label={f.range_name.label}
              keyName="name"
              hint={f.range_name.hint}
              optional
              value={r.name ?? ''}
              onChange={(v) => update(i, { name: v })}
              placeholder={tr.calendar.namePlaceholder}
            />
            <TextField
              label={f.range_start.label}
              keyName="start"
              hint={f.range_start.hint}
              type="date"
              value={r.start}
              onChange={(v) => update(i, { start: v })}
            />
            <TextField
              label={f.range_end.label}
              keyName="end"
              hint={f.range_end.hint}
              type="date"
              value={r.end}
              onChange={(v) => update(i, { end: v })}
            />
          </div>
          <button className="btn-icon danger range-remove" title={tr.common.remove} onClick={() => remove(i)}>
            ✕
          </button>
        </div>
      ))}
    </fieldset>
  );
}

interface RangeFieldsProps {
  label: string;
  keyName: string;
  hint: string;
  range: DateRange;
  onChange: (range: DateRange) => void;
}

/** Период из двух дат (orientation_week / exam_period / grading_period). */
function RangeFields({ label, keyName, hint, range, onChange }: RangeFieldsProps) {
  const f = t().fields.calendar;
  return (
    <div className="range">
      <span className="field-label">
        <span className="field-name">{label}</span>
        <span className="field-key mono">{keyName}</span>
      </span>
      <span className="field-hint">{hint}</span>
      <div className="fields">
        <TextField label={f.range_start.label} keyName="start" type="date" value={range.start} onChange={(v) => onChange({ ...range, start: v })} />
        <TextField label={f.range_end.label} keyName="end" type="date" value={range.end} onChange={(v) => onChange({ ...range, end: v })} />
      </div>
    </div>
  );
}

interface Props {
  doc: AcadCalendarDoc;
  onChange: (doc: AcadCalendarDoc) => void;
}

export default function CalendarEditor({ doc, onChange }: Props) {
  const tr = t();
  const ct = tr.calendar;
  const f = tr.fields.calendar;
  const set = <K extends keyof AcadCalendarDoc>(key: K, value: AcadCalendarDoc[K]): void =>
    onChange({ ...doc, [key]: value });

  const semesters = doc.semesters;
  const updateSemester = (index: number, patch: Partial<SemesterCalendar>): void =>
    set('semesters', semesters.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const addSemester = (): void => {
    const nextNum = semesters.reduce((max, s) => Math.max(max, s.semester), 0) + 1;
    set('semesters', [...semesters, emptySemester(nextNum)]);
  };
  const removeSemester = (index: number): void =>
    set('semesters', semesters.filter((_, i) => i !== index));

  return (
    <>
      <Section title={ct.yearTitle} subtitle="AcadCalendar · acad_calendar.json">
        <div className="fields">
          <NumberField label={f.course.label} keyName="course" hint={f.course.hint} min={1} value={doc.course} onChange={(v) => set('course', v)} />
          <TextField label={f.academic_year.label} keyName="academic_year" hint={f.academic_year.hint} mono value={doc.academic_year} onChange={(v) => set('academic_year', v)} placeholder="2026-2027" />
        </div>
      </Section>

      {semesters.map((s, i) => (
        <Section
          key={i}
          title={ct.semesterTitle(s.semester > 0 ? s.semester : i + 1)}
          subtitle={`semesters[${i}]`}
          action={
            <button
              className="btn-icon danger"
              title={ct.removeSemester}
              onClick={() => removeSemester(i)}
            >
              ✕
            </button>
          }
        >
          <div className="fields">
            <NumberField label={f.semester.label} keyName="semester" hint={f.semester.hint} min={1} value={s.semester} onChange={(v) => updateSemester(i, { semester: v })} />
            <NumberField label={f.total_weeks.label} keyName="total_weeks" hint={f.total_weeks.hint} min={1} value={s.total_weeks} onChange={(v) => updateSemester(i, { total_weeks: v })} />
            <TextField label={f.semester_start.label} keyName="semester_start" hint={f.semester_start.hint} type="date" value={s.semester_start} onChange={(v) => updateSemester(i, { semester_start: v })} />
            <TextField label={f.semester_end.label} keyName="semester_end" hint={f.semester_end.hint} type="date" value={s.semester_end} onChange={(v) => updateSemester(i, { semester_end: v })} />
          </div>

          <RangeFields
            label={f.orientation_week.label}
            keyName="orientation_week"
            hint={f.orientation_week.hint}
            range={s.orientation_week}
            onChange={(r) => updateSemester(i, { orientation_week: r })}
          />
          <RangeFields
            label={f.exam_period.label}
            keyName="exam_period"
            hint={f.exam_period.hint}
            range={s.exam_period}
            onChange={(r) => updateSemester(i, { exam_period: r })}
          />
          <NamedRanges
            title={f.midterm_controls.label}
            subtitle="midterm_controls"
            hint={f.midterm_controls.hint}
            items={s.midterm_controls}
            onChange={(items) => updateSemester(i, { midterm_controls: items })}
          />
          <NamedRanges
            title={f.holidays.label}
            subtitle="holidays"
            hint={f.holidays.hint}
            items={s.holidays}
            onChange={(items) => updateSemester(i, { holidays: items })}
          />
        </Section>
      ))}

      <div className="stack-row">
        <button className="btn" onClick={addSemester}>
          {ct.addSemester}
        </button>
      </div>

      <Section title={ct.practicesTitle} subtitle="practices">
        <NamedRanges
          title={f.practices.label}
          subtitle="practices"
          hint={f.practices.hint}
          items={doc.practices}
          onChange={(items) => set('practices', items)}
        />
      </Section>

      <Section title={ct.gradingTitle} subtitle="grading_period">
        <RangeFields
          label={f.grading_period.label}
          keyName="grading_period"
          hint={f.grading_period.hint}
          range={doc.grading_period}
          onChange={(r) => set('grading_period', r)}
        />
      </Section>
    </>
  );
}
