import { useState } from 'react';
import type { PdfLink, SubjectDoc, Teacher, Topic, TopicType } from '../types';
import { emptyTopic } from '../lib/defaults';
import { t } from '../lib/i18n';
import { FieldHead, GroupCard, NumberField, Section, TextAreaField, TextField } from './bits';

const TOPIC_TYPES: TopicType[] = [
  'lecture',
  'practice',
  'lab',
  'srsp',
  'srs',
  'mini_project',
  'military',
  'other',
];

/** Фиксированный порядок групп; в «other» попадают mini_project, lab, military, other. */
const TOPIC_GROUPS: ReadonlyArray<{ key: 'lecture' | 'practice' | 'srsp' | 'srs' | 'other'; types: TopicType[] }> = [
  { key: 'lecture', types: ['lecture'] },
  { key: 'practice', types: ['practice'] },
  { key: 'srsp', types: ['srsp'] },
  { key: 'srs', types: ['srs'] },
  { key: 'other', types: ['mini_project', 'lab', 'military', 'other'] },
];

type TopicGroupKey = (typeof TOPIC_GROUPS)[number]['key'];

const groupOfType = (type: TopicType): TopicGroupKey =>
  (TOPIC_GROUPS.find((g) => g.types.includes(type)) ?? TOPIC_GROUPS[4]).key;

interface TopicRowProps {
  topic: Topic;
  onChange: (patch: Partial<Topic>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  canUp: boolean;
  canDown: boolean;
}

/** Одна тема: тип + неделя + текст, ↑/↓ переставляют внутри своей группы. */
function TopicRow({ topic, onChange, onRemove, onMove, canUp, canDown }: TopicRowProps) {
  const tr = t();
  const st = tr.subject;
  const f = tr.fields.subject;
  return (
    <div className="topic-row">
      <div className="topic-grid">
        <div className="field">
          <FieldHead label={f.topic_type.label} keyName="type" hint={f.topic_type.hint} />
          <select
            value={topic.type}
            title={st.topicTypes[topic.type].title}
            onChange={(e) => onChange({ type: e.target.value as TopicType })}
          >
            {TOPIC_TYPES.map((value) => (
              <option key={value} value={value} title={st.topicTypes[value].title}>
                {st.topicTypes[value].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <FieldHead label={f.topic_week.label} keyName="week" hint={f.topic_week.hint} />
          <input
            type="number"
            min={1}
            value={topic.week}
            onChange={(e) => onChange({ week: e.target.value === '' ? 0 : Number(e.target.value) })}
          />
        </div>
        <div className="field topic-topic">
          <FieldHead label={f.topic_topic.label} keyName="topic" hint={f.topic_topic.hint} />
          <input
            value={topic.topic}
            placeholder={st.topicPlaceholder}
            title={topic.topic !== '' ? topic.topic : undefined}
            onChange={(e) => onChange({ topic: e.target.value })}
          />
        </div>
        <div className="topic-actions">
          <button className="btn-icon" title={tr.common.up} disabled={!canUp} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button className="btn-icon" title={tr.common.down} disabled={!canDown} onClick={() => onMove(1)}>
            ↓
          </button>
          <button className="btn-icon danger" title={tr.common.remove} onClick={onRemove}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

interface PdfRowProps {
  pdf: PdfLink;
  onChange: (patch: Partial<PdfLink>) => void;
  onRemove: () => void;
}

/** Один PDF-файл: название / имя файла / ссылка с объяснениями. */
function PdfRow({ pdf, onChange, onRemove }: PdfRowProps) {
  const tr = t();
  const st = tr.subject;
  const f = tr.fields.subject;
  return (
    <div className="range-item">
      <div className="fields">
        <TextField label={f.pdf_title.label} keyName="title" hint={f.pdf_title.hint} value={pdf.title} onChange={(v) => onChange({ title: v })} placeholder={st.pdfTitlePlaceholder} />
        <TextField label={f.pdf_filename.label} keyName="filename" hint={f.pdf_filename.hint} value={pdf.filename} onChange={(v) => onChange({ filename: v })} placeholder="lecture-1.pdf" />
        <TextField label={f.pdf_url.label} keyName="url" hint={f.pdf_url.hint} value={pdf.url} onChange={(v) => onChange({ url: v })} placeholder="https://…" />
      </div>
      <button className="btn-icon danger range-remove" title={tr.common.remove} onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

interface Props {
  doc: SubjectDoc;
  onChange: (doc: SubjectDoc) => void;
}

export default function SubjectEditor({ doc, onChange }: Props) {
  const set = <K extends keyof SubjectDoc>(key: K, value: SubjectDoc[K]): void =>
    onChange({ ...doc, [key]: value });

  const topics = doc.topics;

  // Группы тем: по умолчанию развёрнуты непустые.
  const [openGroups, setOpenGroups] = useState<Record<TopicGroupKey, boolean>>(() => {
    const rec: Record<TopicGroupKey, boolean> = { lecture: false, practice: false, srsp: false, srs: false, other: false };
    for (const tp of topics) rec[groupOfType(tp.type)] = true;
    return rec;
  });

  const updateTopic = (index: number, patch: Partial<Topic>): void =>
    set('topics', topics.map((tp, i) => (i === index ? { ...tp, ...patch } : tp)));
  const removeTopic = (index: number): void => set('topics', topics.filter((_, i) => i !== index));

  /** Обмен местами двух тем плоского массива (обе — из одной группы). */
  const moveWithinGroup = (indices: number[], pos: number, dir: -1 | 1): void => {
    const to = pos + dir;
    if (to < 0 || to >= indices.length) return;
    const next = [...topics];
    const a = indices[pos];
    const b = indices[to];
    next[a] = topics[b];
    next[b] = topics[a];
    set('topics', next);
  };

  /** «+ тема» в группе: вставляется сразу после последней темы этой группы. */
  const addTopicToGroup = (group: (typeof TOPIC_GROUPS)[number]): void => {
    const indices = topics.reduce<number[]>((acc, tp, i) => {
      if (group.types.includes(tp.type)) acc.push(i);
      return acc;
    }, []);
    const last = indices.length > 0 ? indices[indices.length - 1] : -1;
    const fresh = emptyTopic(last >= 0 ? topics[last].week + 1 : 1);
    fresh.type = group.types[0];
    const next = [...topics];
    // после последней темы своей группы, а если группа пуста — в конец списка
    next.splice(last + 1 < 0 ? topics.length : last + 1, 0, fresh);
    set('topics', next);
    setOpenGroups((prev) => ({ ...prev, [group.key]: true }));
  };

  const pdfs = doc.pdfs;
  const updatePdf = (index: number, patch: Partial<PdfLink>): void =>
    set('pdfs', (pdfs ?? []).map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const addPdf = (): void => set('pdfs', [...(pdfs ?? []), { title: '', filename: '', url: '' }]);
  const removePdf = (index: number): void => {
    const next = (pdfs ?? []).filter((_, i) => i !== index);
    set('pdfs', next.length > 0 ? next : undefined);
  };

  const setTeacher = (patch: Partial<Teacher>): void =>
    onChange({ ...doc, teacher: { ...doc.teacher, ...patch } });

  const tr = t();
  const tt = tr.subject;
  const fs = tr.fields.subject;

  return (
    <>
      <Section title={tt.mainTitle} subtitle="Subject · <subject_id>.json">
        <div className="fields">
          <TextField label={fs.subject_id.label} keyName="subject_id" hint={fs.subject_id.hint} mono value={doc.subject_id} onChange={(v) => set('subject_id', v)} placeholder="aleumettanu" />
          <TextField label={fs.subject_code.label} keyName="subject_code" hint={fs.subject_code.hint} mono value={doc.subject_code} onChange={(v) => set('subject_code', v)} placeholder="В.013" />
          <TextField label={fs.subject_name.label} keyName="subject_name" hint={fs.subject_name.hint} wide value={doc.subject_name} onChange={(v) => set('subject_name', v)} placeholder={tt.subjectNamePlaceholder} />
          <NumberField label={fs.course.label} keyName="course" hint={fs.course.hint} min={1} value={doc.course} onChange={(v) => set('course', v)} />
          <NumberField label={fs.semester.label} keyName="semester" hint={fs.semester.hint} min={1} value={doc.semester} onChange={(v) => set('semester', v)} />
          <NumberField label={fs.credits_ects.label} keyName="credits_ects" hint={fs.credits_ects.hint} min={1} value={doc.credits_ects} onChange={(v) => set('credits_ects', v)} />
        </div>
      </Section>

      <Section title={tt.teacherTitle} subtitle="teacher · description">
        <div className="fields">
          <TextField label={fs.teacher_name.label} keyName="teacher.name" hint={fs.teacher_name.hint} wide value={doc.teacher.name} onChange={(v) => setTeacher({ name: v })} placeholder={tt.teacherNamePlaceholder} />
          <TextField label={fs.teacher_phone.label} keyName="teacher.phone" hint={fs.teacher_phone.hint} optional value={doc.teacher.phone ?? ''} onChange={(v) => setTeacher({ phone: v })} placeholder="+7 (___) ___-__-__" />
          <TextField label={fs.teacher_email.label} keyName="teacher.email" hint={fs.teacher_email.hint} optional type="email" value={doc.teacher.email ?? ''} onChange={(v) => setTeacher({ email: v })} placeholder="teacher@university.kz" />
        </div>
        <TextAreaField label={fs.description.label} keyName="description" hint={fs.description.hint} rows={4} value={doc.description} onChange={(v) => set('description', v)} placeholder={tt.descriptionPlaceholder} />
      </Section>

      <Section title={tt.topicsTitle} subtitle="topics">
        <p className="hint">{tt.topicsHint}</p>
        <div className="topic-groups">
          {TOPIC_GROUPS.map((group) => {
            const indices = topics.reduce<number[]>((acc, tp, i) => {
              if (group.types.includes(tp.type)) acc.push(i);
              return acc;
            }, []);
            const gt = tt.topicGroups[group.key];
            return (
              <GroupCard
                key={group.key}
                open={openGroups[group.key]}
                onToggle={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                title={gt.label}
                titleTitle={gt.title}
                count={indices.length}
                actions={
                  <button className="btn small" onClick={() => addTopicToGroup(group)}>
                    {tt.addTopicShort}
                  </button>
                }
              >
                {indices.length === 0 ? (
                  <p className="empty-note">{tt.topicsEmptyGroup}</p>
                ) : (
                  indices.map((topicIndex, pos) => (
                    <TopicRow
                      key={topicIndex}
                      topic={topics[topicIndex]}
                      onChange={(patch) => updateTopic(topicIndex, patch)}
                      onRemove={() => removeTopic(topicIndex)}
                      onMove={(dir) => moveWithinGroup(indices, pos, dir)}
                      canUp={pos > 0}
                      canDown={pos < indices.length - 1}
                    />
                  ))
                )}
              </GroupCard>
            );
          })}
        </div>
      </Section>

      <Section title={tt.pdfsTitle} subtitle={tt.pdfsSubtitle}>
        <p className="hint">{tt.pdfHint}</p>
        {pdfs === undefined ? (
          <div className="stack-row">
            <span className="muted">{tr.common.notSet}</span>
            <button className="btn small" onClick={addPdf}>
              {tt.addPdfLinks}
            </button>
          </div>
        ) : (
          <>
            {pdfs.map((p, i) => (
              <PdfRow key={i} pdf={p} onChange={(patch) => updatePdf(i, patch)} onRemove={() => removePdf(i)} />
            ))}
            <button className="btn" onClick={addPdf}>
              {tt.addPdf}
            </button>
          </>
        )}
      </Section>
    </>
  );
}
