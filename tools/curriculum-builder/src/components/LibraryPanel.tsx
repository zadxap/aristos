import type { SubjectDoc } from '../types';
import { t } from '../lib/i18n';

interface Props {
  library: SubjectDoc[];
  current: SubjectDoc;
  onSave: (doc: SubjectDoc) => void;
  onLoad: (doc: SubjectDoc) => void;
  onDelete: (subjectId: string) => void;
}

export default function LibraryPanel({ library, current, onSave, onLoad, onDelete }: Props) {
  const currentId = current.subject_id.trim();
  const alreadySaved = library.some((s) => s.subject_id === currentId);
  const tr = t().library;

  return (
    <section className="panel">
      <h2 className="panel-title">
        {tr.title} <span className="badge">{library.length}</span>
      </h2>
      <p className="hint">{tr.hint}</p>
      <div className="btn-row">
        <button
          className="btn"
          disabled={currentId === ''}
          title={currentId === '' ? tr.needSubjectId : undefined}
          onClick={() => onSave(current)}
        >
          {alreadySaved ? tr.updateCurrent : tr.saveCurrent}
        </button>
      </div>
      {library.length === 0 ? (
        <p className="empty-note">{t().common.nothingSaved}</p>
      ) : (
        <ul className="library">
          {library.map((s) => (
            <li key={s.subject_id}>
              <button
                className="lib-open"
                title={t().common.openInEditor}
                onClick={() => onLoad(s)}
              >
                <span className="lib-name">{s.subject_name !== '' ? s.subject_name : s.subject_id}</span>
                <span className="lib-sub mono">
                  {s.subject_code !== '' ? `${s.subject_code} · ` : ''}
                  {s.subject_id} · {tr.libSub(s.course, s.semester)}
                </span>
              </button>
              <button
                className="btn-icon danger"
                title={tr.removeFromLibrary}
                onClick={() => onDelete(s.subject_id)}
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
